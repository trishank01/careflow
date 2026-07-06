import os
import json
import requests
from fastapi import FastAPI, Request, HTTPException
from pydantic import BaseModel
from kubernetes import client, config
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.tools import tool

app = FastAPI(title="CareFlow AI SRE Agent", version="1.0.0")

# ── EKS Kubernetes API Client Setup ──────────────────────────────────────────
try:
    # Try loading incluster config (running inside EKS worker node)
    config.load_incluster_config()
except Exception:
    try:
        # Fallback to local kubeconfig for development
        config.load_kube_config()
    except Exception:
        print("Warning: Could not configure Kubernetes client. K8s tools will fail.")

k8s_v1 = client.CoreV1Api()

# ── LangChain Tools Definitions ──────────────────────────────────────────────

@tool
def get_k8s_pod_logs(pod_name: str, namespace: str) -> str:
    """Retrieves stdout/stderr logs of a specific Kubernetes pod in a namespace. Useful for finding error traces."""
    try:
        # Fetch up to 100 lines of logs to prevent token bloat
        logs = k8s_v1.read_namespaced_pod_log(
            name=pod_name,
            namespace=namespace,
            tail_lines=100
        )
        return logs
    except Exception as e:
        return f"Error retrieving logs for pod {pod_name}: {str(e)}"

@tool
def describe_k8s_pod(pod_name: str, namespace: str) -> str:
    """Retrieves status, state, exit codes, and recent event details for a specific Kubernetes pod. Useful for diagnosing CrashLoopBackOff or Pending states."""
    try:
        pod = k8s_v1.read_namespaced_pod(name=pod_name, namespace=namespace)
        
        # Format key status details
        status_info = {
            "phase": pod.status.phase,
            "conditions": [{"type": c.type, "status": c.status} for c in pod.status.conditions] if pod.status.conditions else [],
            "container_statuses": []
        }
        
        if pod.status.container_statuses:
            for cs in pod.status.container_statuses:
                state_detail = {}
                if cs.state.waiting:
                    state_detail = {"state": "waiting", "reason": cs.state.waiting.reason, "message": cs.state.waiting.message}
                elif cs.state.running:
                    state_detail = {"state": "running", "started_at": str(cs.state.running.started_at)}
                elif cs.state.terminated:
                    state_detail = {"state": "terminated", "exit_code": cs.state.terminated.exit_code, "reason": cs.state.terminated.reason, "message": cs.state.terminated.message}
                
                status_info["container_statuses"].append({
                    "name": cs.name,
                    "ready": cs.ready,
                    "restart_count": cs.restart_count,
                    "state": state_detail
                })
                
        return json.dumps(status_info, indent=2)
    except Exception as e:
        return f"Error describing pod {pod_name}: {str(e)}"

@tool
def query_sre_knowledge_base(query: str) -> str:
    """Searches the local ChromaDB vector database containing SRE runbooks and troubleshooting guides. Returns matches on how to fix common K8s errors (OOMKilled, CrashLoopBackOff)."""
    try:
        db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db")
        if not os.path.exists(db_path):
            return "Knowledge base database directory not found. Please populate runbooks first."
            
        embeddings = OpenAIEmbeddings()
        db = Chroma(persist_directory=db_path, embedding_function=embeddings)
        docs = db.similarity_search(query, k=2)
        
        results = []
        for doc in docs:
            results.append(f"Source: {doc.metadata.get('source', 'unknown')}\n{doc.page_content}")
            
        return "\n\n---\n\n".join(results)
    except Exception as e:
        return f"Error searching vector knowledge base: {str(e)}"

# ── Agent System Core ─────────────────────────────────────────────────────────

def run_diagnostic_agent(pod_name: str, namespace: str, alert_name: str) -> str:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        return "SRE Agent configuration error: OPENAI_API_KEY is missing."

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    tools = [get_k8s_pod_logs, describe_k8s_pod, query_sre_knowledge_base]

    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an expert Autonomous Site Reliability Engineer (SRE) Agent in EKS clusters.
Your goal is to diagnose a failing Kubernetes pod that has triggered an alert.
You have access to tools that fetch pod logs, retrieve pod description status fields (including exit codes), and query a vector database containing SRE runbooks.

Follow this plan:
1. Call `describe_k8s_pod` to get status, container waiting/terminated states, and restart counts.
2. Call `get_k8s_pod_logs` to read application logs if the pod started and crashed.
3. Call `query_sre_knowledge_base` using keywords from the error status or log traces (e.g. "OOMKilled", "connection timeout", "ImagePullBackOff") to find resolution guidelines.
4. Construct a clear, structured SRE Incident Diagnosis Report.

Your final report must include:
- **Incident Summary**: Pod name, namespace, and alert type.
- **Observed Symptoms**: Current state, restart counts, exit codes, and core error logs.
- **Root Cause Analysis (RCA)**: Explain *why* the failure happened.
- **Recommended Action**: Detailed step-by-step fix commands or YAML configuration changes.
"""),
        ("human", "Diagnose the incident for pod: '{pod_name}' in namespace: '{namespace}'. The alert triggered is: '{alert_name}'."),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])

    agent = create_openai_tools_agent(llm, tools, prompt)
    executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

    response = executor.invoke({
        "pod_name": pod_name,
        "namespace": namespace,
        "alert_name": alert_name
    })

    return response.get("output", "Could not complete diagnosis.")

# ── REST Webhook Handlers ──────────────────────────────────────────────────────

def post_to_slack(report_text: str):
    webhook_url = os.environ.get("SLACK_WEBHOOK_URL")
    if not webhook_url:
        print("SLACK_WEBHOOK_URL not configured. Printing report to console instead:")
        print(report_text)
        return
        
    payload = {
        "text": f"🚨 *AI SRE Agent Incident Alert*\n\n{report_text}"
    }
    
    try:
        res = requests.post(webhook_url, json=payload, headers={"Content-Type": "application/json"})
        if res.status_code != 200:
            print(f"Failed to post alert to Slack. Status: {res.status_code}")
    except Exception as e:
        print(f"Error calling Slack webhook: {e}")

@app.post("/api/webhook/alert")
async def alertmanager_webhook(request: Request):
    try:
        payload = await request.json()
        print("Received alert from Alertmanager:", json.dumps(payload))
        
        alerts = payload.get("alerts", [])
        if not alerts:
            return {"status": "ignored", "message": "No alerts found in webhook payload."}
            
        reports_generated = 0
        for alert in alerts:
            status = alert.get("status")
            if status != "firing":
                continue # Ignore alerts that have been resolved
                
            labels = alert.get("labels", {})
            alert_name = labels.get("alertname", "UnknownAlert")
            pod_name = labels.get("pod")
            namespace = labels.get("namespace", "default")
            
            if not pod_name:
                print(f"Alert {alert_name} has no associated pod label. Skipping.")
                continue
                
            print(f"Triggering diagnostic agent for pod {pod_name} in namespace {namespace}...")
            
            # Run the autonomous reasoning loops
            diagnosis_report = run_diagnostic_agent(pod_name, namespace, alert_name)
            
            # Post final analysis to Slack
            post_to_slack(diagnosis_report)
            reports_generated += 1
            
        return {"status": "success", "reports_generated": reports_generated}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8090)
