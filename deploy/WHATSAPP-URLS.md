# WhatsApp Banking — public URL format
# Base: https://223.30.224.244:6443/

# All links require dynamic customerId and mobile from WhatsApp.

# 1. Open Fixed Deposit
https://223.30.224.244:6443/?service=openfd&customerId=R00047&mobile=9908360790

# 2. Positive Payment System (PPS)
https://223.30.224.244:6443/?service=pps&customerId=R00047&mobile=9908360790

# 3. Nominee Registration
https://223.30.224.244:6443/?service=nominee&customerId=R00047&mobile=9908360790

# 4. PM Social Schemes (add subservice)
https://223.30.224.244:6443/?service=pmsocial&subservice=PMJJBY&customerId=R00047&mobile=9908360790
https://223.30.224.244:6443/?service=pmsocial&subservice=PMSBY&customerId=R00047&mobile=9908360790
https://223.30.224.244:6443/?service=pmsocial&subservice=PMAPY&customerId=R00047&mobile=9908360790

# Query parameters
# | Param       | Required | Example    | Notes                          |
# |-------------|----------|------------|--------------------------------|
# | service     | Yes      | openfd     | pps | nominee | pmsocial | openfd |
# | customerId  | Yes      | R00047     | From WhatsApp / bank CRM       |
# | mobile      | Yes      | 9908360790 | Customer registered mobile     |
# | subservice  | PM only  | PMJJBY     | PMJJBY | PMSBY | PMAPY          |

# Local dev (localhost — dev fallbacks allowed if params omitted):
http://localhost:5173/?service=openfd&customerId=R00047&mobile=9908360790
