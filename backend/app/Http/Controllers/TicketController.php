<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use App\Models\Demande;

class TicketController extends Controller
{
    public function store(Request $request)
    {
        return response()->json([
            'message' => 'Ticket creation is not available through this route.',
        ], Response::HTTP_NOT_IMPLEMENTED);
    }

    public function claim(Request $request, Demande $id)
    {
        return response()->json([
            'message' => 'Ticket claim is not available through this route.',
        ], Response::HTTP_NOT_IMPLEMENTED);
    }

    public function close(Request $request, Demande $id)
    {
        return response()->json([
            'message' => 'Ticket close is not available through this route.',
        ], Response::HTTP_NOT_IMPLEMENTED);
    }
}
