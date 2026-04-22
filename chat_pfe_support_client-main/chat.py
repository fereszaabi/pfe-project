import os
import base64
from pathlib import Path
from langchain_core.prompts import ChatPromptTemplate
from langchain_community.document_loaders.csv_loader import CSVLoader
import shutil
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from dotenv import load_dotenv
from langchain_groq import ChatGroq
from langchain_community.document_loaders import JSONLoader
from langdetect import detect, LangDetectException
from groq import Groq  # ✅ Groq Vision


LANGUAGE_LABELS = {
    "fr": "français",
    "en": "anglais",
    "ar": "arabe",
}


def resolve_response_language(text: str) -> str:
    """Return a supported response language label for the prompt."""
    cleaned = (text or "").strip()
    if len(cleaned) < 4:
        return LANGUAGE_LABELS["fr"]

    try:
        detected = detect(cleaned)
    except LangDetectException:
        detected = "fr"

    # Keep chatbot output in explicit supported languages only.
    return LANGUAGE_LABELS.get(detected, LANGUAGE_LABELS["fr"])

load_dotenv()
load_dotenv(dotenv_path=Path(__file__).resolve().parent / ".env", override=True)

groq_api_key = os.getenv("GROQ_API_KEY")
sentence_token = os.getenv("sentence-transformers_API_TOKEN")

if sentence_token:
    os.environ["HF_TOKEN"] = sentence_token

# ✅ Client Groq Vision
groq_client = Groq(api_key=groq_api_key) if groq_api_key else None

def encode_image(image_path: str) -> tuple:
    """Encode l'image en base64."""
    ext = Path(image_path).suffix.lower()
    mime_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp"
    }
    mime = mime_types.get(ext, "image/jpeg")
    with open(image_path, "rb") as f:
        return base64.b64encode(f.read()).decode("utf-8"), mime

def describe_image(image_path: str, question: str = "") -> str:
    """Analyse l'image avec Groq Vision — pas de modèle local."""
    if not os.path.exists(image_path):
        return ""
    if not groq_client:
        return ""
    try:
        image_data, mime_type = encode_image(image_path)

        prompt = f"""Analyse cette image en détail et fournis :
1. Le type d'image (écran erreur, câble, composant matériel, interface logicielle, écran noir...)
2. La couleur dominante de l'écran
3. Tout le texte visible (messages d'erreur, codes, boutons...)
4. Une description précise de ce que tu vois
5. Un diagnostic probable du problème si applicable

Question de l'utilisateur : {question if question else 'Analyse générale'}

Réponds en français de manière structurée."""

        response = groq_client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",  # ✅ Groq Vision
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime_type};base64,{image_data}"
                        }
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }],
            max_tokens=1000
        )
        return response.choices[0].message.content

    except Exception as e:
        print(f" Erreur Groq Vision : {e}")
        return ""

# ── 1. Optional retrieval stack (disabled by default for fast startup) ──────
ENABLE_LOCAL_RETRIEVAL = os.getenv("ENABLE_LOCAL_RETRIEVAL", "0") == "1"
retriever = None

if ENABLE_LOCAL_RETRIEVAL:
    loader = CSVLoader('idsoft_produits_final.csv', encoding='latin-1')
    datacsv = loader.load()

    json_loader1 = JSONLoader(file_path="idsoft_training_data.json",
        jq_schema=".", text_content=False)
    json_loader2 = JSONLoader(file_path="idsoft_training_data1.jsonl",
        jq_schema='. | {text: (.instruction + " " + .output)}',
        json_lines=True, text_content=False)
    json_loader3 = JSONLoader(file_path="idsoft_conversations.jsonl",
        jq_schema='.', json_lines=True, text_content=False)
    json_loader4 = JSONLoader(file_path="idsoft_basic_conversations.jsonl",
        jq_schema='.', json_lines=True, text_content=False)
    json_loader5 = JSONLoader(file_path="idsoft_basic_conversations.json",
        jq_schema=".", text_content=False)

    json_data1 = json_loader1.load()
    json_data2 = json_loader2.load()
    json_data3 = json_loader3.load()
    json_data4 = json_loader4.load()
    json_data5 = json_loader5.load()
    data = datacsv + json_data1 + json_data2 + json_data3 + json_data4 + json_data5

    db_location = "./chroma_db"
    if os.path.exists(db_location):
        shutil.rmtree(db_location)
    os.makedirs(db_location, exist_ok=True)

    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    )
    vector_store = Chroma(
        collection_name="products",
        persist_directory=db_location,
        embedding_function=embeddings
    )

    from langchain_text_splitters import RecursiveCharacterTextSplitter
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=300, chunk_overlap=50)
    data = text_splitter.split_documents(data)
    vector_store.add_documents(data)
    retriever = vector_store.as_retriever(search_kwargs={"k": 3})

chat_history = []

# ── 3. Setup LLM ──────────────────────────────────────────────────
model = None
if groq_api_key:
    model = ChatGroq(
        model="llama-3.3-70b-versatile",
        api_key=groq_api_key,
        temperature=0.2
    )

template = """
Tu es un assistant de support client expert. Réponds en te basant sur le contexte fourni.

## Règles strictes :
1. Si le contexte contient une analyse d'image → utilise-la EN PRIORITÉ pour répondre.
2. Si la réponse se trouve dans le contexte → réponds de manière concise et claire.
3. Si la réponse N'EST PAS clairement dans le contexte → propose une aide générale utile et prudente (étapes de diagnostic simples, vérifications de base), sans inventer de faits spécifiques.
4. Si la question est floue ET qu'il n'y a PAS d'image → demande une clarification.
5. N'invente jamais d'information absente du contexte.
6. Utilise l'historique pour les questions ambiguës.
7. Réponds TOUJOURS dans la langue : {language}, ne jamais répondre dans une langue autre que : {language}
8. Propose de créer un ticket de support uniquement si le problème nécessite une intervention technique interne, un accès au compte, ou si les étapes proposées n'ont pas résolu le problème.
9. Ne jamais poser plusieurs questions à la fois.
9. Ne jamais redemander une information déjà fournie dans l'historique.

Historique :
{history}

Contexte (+ analyse image si fournie) :
{reviews}

Question : {question}

Réponse :
"""

prompt = ChatPromptTemplate.from_template(template)
chain = prompt | model

def ask_support_bot(question: str, history=None, image_path: str = "") -> str:
    """Return a chatbot reply for a single question."""
    if history is None:
        history = []

    image_description = ""
    if image_path and os.path.exists(image_path):
        image_description = describe_image(image_path, question)

    lang = resolve_response_language(question)

    history_text = "\n".join(history)

    if image_description:
        full_question = (
            history_text +
            f"\nUser: {question}" +
            f"\n[Image analysée] : {image_description}"
        )
    else:
        full_question = history_text + f"\nUser: {question}"

    reviews_text = ""
    if retriever is not None:
        docs = retriever.invoke(full_question)
        reviews_text = "\n".join([doc.page_content for doc in docs])
    else:
        reviews_text = (
            "Contexte vectoriel local desactive. Donne d'abord une reponse pratique et utile, "
            "avec des etapes de verification simples. Si la resolution exige une intervention humaine "
            "ou si le probleme persiste apres ces etapes, recommande alors de creer un ticket."
        )

    if model is None:
        return "GROQ_API_KEY manquant. Veuillez configurer la cle API du chatbot."

    if image_description:
        reviews_text = (
            f"[Analyse Groq Vision] :\n"
            f"{image_description}\n\n"
            f"[Contexte base de données] :\n{reviews_text}"
        )

    result = chain.invoke({
        "history": history,
        "reviews": reviews_text,
        "question": question,
        "language": lang
    })

    return result.content


def run_cli_chat_loop():
    print("=== IDSoft After-Sales Assistant ===")
    print("Press Ctrl+C to quit.\n")

    while True:
        question = input("Ask your question: ").strip()
        if not question:
            continue

        image_input = input("Image path (or Enter to skip): ").strip()
        answer = ask_support_bot(question, history=chat_history, image_path=image_input)
        print(f"\nAnswer: {answer}\n")

        chat_history.append(f"User: {question}")
        if image_input and os.path.exists(image_input):
            chat_history.append(f"[Image] : {image_input}")

        if answer == "Veuillez créer un ticket de support.":
            chat_history.append("Assistant: Veuillez créer un ticket de support.")
        else:
            chat_history.append(f"Assistant: {answer}")


if __name__ == "__main__":
    run_cli_chat_loop()