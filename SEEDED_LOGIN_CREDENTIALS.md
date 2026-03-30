# 🔐 Seeded Login Credentials

Database has been successfully seeded with 10 test users across all roles.

---

## 📋 Authentication Format

### CIN (Numéro d'Identité Civile)
- Format: `^[01]\d{7}$`
- Description: 8 digits, must start with **0** or **1**
- Examples: `00000001`, `01111111`, `05555555`

### Code Fiscale (Numéro de Matricule Fiscal)
- Format: `^\d{4}[A-Z]{3}\d{4}$`
- Description: 4 digits + 3 UPPERCASE letters + 4 digits
- Examples: `0001ADM0001`, `1111GOU1111`, `5555RET5555`

---

## 👤 Admin Account

| Field | Value |
|-------|-------|
| **Name** | Admin User |
| **Email** | admin@idsoft.com |
| **CIN** | 00000001 |
| **Code Fiscale** | 0001ADM0001 |
| **Password** | Admin@1234 |
| **Role** | admin |
| **Status** | Active |

---

## 👷 Employee Accounts

### Employee 1: Marco Rivera
| Field | Value |
|-------|-------|
| **Email** | marco.rivera@idsoft.tn |
| **CIN** | 01234567 |
| **Code Fiscale** | 1234RIV5678 |
| **Password** | Tech@2024 |
| **Status** | Active |

### Employee 2: Sarah Johnson
| Field | Value |
|-------|-------|
| **Email** | sarah.johnson@idsoft.tn |
| **CIN** | 10876543 |
| **Code Fiscale** | 5432JOH8765 |
| **Password** | Tech@2024 |
| **Status** | Active |

### Employee 3: Ahmed Ben Ali
| Field | Value |
|-------|-------|
| **Email** | ahmed.benali@idsoft.tn |
| **CIN** | 01555555 |
| **Code Fiscale** | 1555ALI5555 |
| **Password** | Tech@2024 |
| **Status** | Active |

---

## 🏢 Client Accounts

### Client 1: Gourmet Haven Ltd (ACTIVE)
| Field | Value |
|-------|-------|
| **Email** | contact@gourmethaven.com |
| **CIN** | 01111111 |
| **Code Fiscale** | 1111GOU1111 |
| **Password** | Client@1234 |
| **Account Balance** | 2,450.00 TND |
| **Status** | Active |

### Client 2: TechPro Solutions (ACTIVE)
| Field | Value |
|-------|-------|
| **Email** | support@techpro.tn |
| **CIN** | 02222222 |
| **Code Fiscale** | 2222TEC2222 |
| **Password** | Client@1234 |
| **Account Balance** | 1,850.50 TND |
| **Status** | Active |

### Client 3: Finance Plus Group (ACTIVE)
| Field | Value |
|-------|-------|
| **Email** | director@financeplus.tn |
| **CIN** | 03333333 |
| **Code Fiscale** | 3333FIN3333 |
| **Password** | Client@1234 |
| **Account Balance** | 5,200.75 TND |
| **Status** | Active |

### Client 4: Inactive Business Inc (INACTIVE)
| Field | Value |
|-------|-------|
| **Email** | owner@inactivebiz.tn |
| **CIN** | 04444444 |
| **Code Fiscale** | 4444INA4444 |
| **Password** | Client@1234 |
| **Account Balance** | 0.00 TND |
| **Status** | ❌ Inactive |

### Client 5: Retail Express Store (ACTIVE)
| Field | Value |
|-------|-------|
| **Email** | manager@retailexpress.tn |
| **CIN** | 05555555 |
| **Code Fiscale** | 5555RET5555 |
| **Password** | Client@1234 |
| **Account Balance** | 3,100.00 TND |
| **Status** | Active |

---

## 🧪 Testing Login Flow

### Test Case 1: Login with CIN
```
Identifier: 01111111  (CIN for Gourmet Haven)
Password: Client@1234
Expected: ✅ Login successful, returns client token
```

### Test Case 2: Login with Code Fiscale
```
Identifier: 1111GOU1111  (Code Fiscale for Gourmet Haven)
Password: Client@1234
Expected: ✅ Login successful, same user as Test Case 1
```

### Test Case 3: Login with Inactive Client
```
Identifier: 04444444  (CIN for Inactive Business Inc)
Password: Client@1234
Expected: ❌ Login should fail (client_state = 'inactive')
```

### Test Case 4: Admin Login
```
Identifier: 00000001  (CIN for Admin)
Password: Admin@1234
Expected: ✅ Login successful, returns admin token
```

---

## 📊 Summary

| Role | Count | Email Format |
|------|-------|--------------|
| Admin | 1 | admin@idsoft.com |
| Employees | 3 | firstname.lastname@idsoft.tn |
| Active Clients | 4 | Various domains |
| Inactive Clients | 1 | owner@inactivebiz.tn |
| **Total Users** | **10** | - |

---

## ✍️ Important Notes

1. **All usernames are CIN or Code Fiscale** - Email login is NOT supported
2. **Inactive Client Test** - Try logging in with `04444444` to verify client_state enforcement
3. **Account Balances** - Only clients have money balances (used for service deductions)
4. **Role-based Routing** - Each login will be routed to appropriate dashboard:
   - Admin → Admin Dashboard
   - Employee → Employee Dashboard (Ticket Assignment)
   - Client → Client Dashboard (Service Requests)

---

## 🔄 How to Re-seed

If you need to reset and re-seed the database:

```bash
# Reset all data
php artisan migrate:refresh

# Re-seed with sample data
php artisan db:seed --class=SampleDataSeeder
```

---

**Last Updated**: After migrations and seeding completed
