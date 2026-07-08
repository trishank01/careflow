import uvicorn
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel

app = FastAPI(title="CareFlow Auth Service", version="1.0.0")

class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str
    role: str = "patient"

# In-memory user database
USERS = {
    "admin": {"password": "careflow123", "role": "doctor"},
    "dr_smith": {"password": "doctor123", "role": "doctor"},
    "dr_jones": {"password": "doctor123", "role": "doctor"},
    "dr_patel": {"password": "doctor123", "role": "doctor"},
    "ajay": {"password": "patient123", "role": "patient"},
    "harsh": {"password": "patient123", "role": "patient"},
    "aman": {"password": "patient123", "role": "patient"},
    "alok": {"password": "patient123", "role": "patient"},
     "harsh": {"password": "patient123", "role": "patient"}
}

@app.get("/api/auth/health")
def health_check():
    return {"status": "healthy"}

@app.get("/api/auth/doctors")
def get_doctors():
    doctors_list = []
    for uname, info in USERS.items():
        if info["role"] == "doctor" and uname != "admin":
            display_name = f"Dr. {uname[3:].capitalize()}" if uname.startswith("dr_") else uname.capitalize()
            doctors_list.append({"username": uname, "displayName": display_name})
    return doctors_list

@app.post("/api/auth/register")
def register(request: RegisterRequest):
    if not request.username.strip() or not request.password.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username and password cannot be empty"
        )
    if request.username in USERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    role = request.role.lower() if request.role else "patient"
    if role not in ["patient", "doctor"]:
        role = "patient"
        
    USERS[request.username] = {
        "password": request.password,
        "role": role
    }
    return {"status": "success", "message": "User registered successfully"}

@app.post("/api/auth/login")
def login(request: LoginRequest):
    username = request.username
    if username in USERS and USERS[username]["password"] == request.password:
        return {
            "status": "success",
            "token": f"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.MockTokenFor{username}",
            "role": USERS[username]["role"]
        }
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials"
    )

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
