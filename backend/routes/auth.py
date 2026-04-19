from fastapi import APIRouter
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
import os
from dotenv import load_dotenv

load_dotenv()

router = APIRouter()

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
]

def get_flow():
    return Flow.from_client_config(
        {
            "web": {
                "client_id": os.getenv("GOOGLE_CLIENT_ID"),
                "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        },
        scopes=SCOPES,
        redirect_uri=os.getenv("GOOGLE_REDIRECT_URI"),
        autogenerate_code_verifier=False,
    )


@router.get("/login")
def login():
    print("Login hit")
    flow = get_flow()
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent"      # forces refresh token every time
    )
    return RedirectResponse(auth_url)


@router.get("/callback")
def callback(code: str):
    print("Callback hit")
    flow = get_flow()
    flow.fetch_token(code=code)


    credentials = flow.credentials

    # Print tokens — copy refresh token into mcp-server/.env
    print("\n✅ AUTH SUCCESS")
    print(f"Access Token:  {credentials.token}")
    print(f"Refresh Token: {credentials.refresh_token}")
    print("\nCopy the refresh token into your mcp-server/.env\n")

    # TODO: store in DB per user — for now just return it
    return {
        "access_token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "message": "Copy the refresh token into mcp-server/.env"
    }



from services.mcp_service import get_mcp_tools, call_mcp_tool

@router.get("/test-mcp")
async def test_mcp():
    # test 1 - list available tools
    tools = await get_mcp_tools()
    tool_names = [tool.name for tool in tools.tools]
    
    # test 2 - fetch 3 unread emails
    emails = await call_mcp_tool("gmail_list_messages", {
        "query": "is:unread",
        "maxResults": 3
    })
    
    return {
        "available_tools": tool_names,
        "emails": emails
    }
