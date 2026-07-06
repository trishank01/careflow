import os
import glob
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document

RUNBOOKS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "runbooks")
DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "db")

def populate_runbooks_db():
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("Warning: OPENAI_API_KEY environment variable not found. Using empty string placeholder.")
        api_key = "placeholder"
        
    print(f"Reading runbooks from: {RUNBOOKS_DIR}")
    runbooks_files = glob.glob(os.path.join(RUNBOOKS_DIR, "*.md"))
    
    documents = []
    for file_path in runbooks_files:
        filename = os.path.basename(file_path)
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        # Parse sections as individual document chunks to ensure high context retrieval precision
        sections = content.split("## ")
        title = sections[0].strip()
        
        for section in sections[1:]:
            section_title = section.split("\n")[0].strip()
            section_body = "\n".join(section.split("\n")[1:]).strip()
            
            chunk_content = f"{title}\n\nSection: {section_title}\n{section_body}"
            doc = Document(
                page_content=chunk_content,
                metadata={"source": filename, "topic": section_title}
            )
            documents.append(doc)
            
    if not documents:
        print("No runbook documents found to load.")
        return
        
    print(f"Loaded {len(documents)} runbook chunks. Storing in ChromaDB at {DB_DIR}...")
    embeddings = OpenAIEmbeddings(openai_api_key=api_key)
    
    # Save database to disk
    Chroma.from_documents(
        documents=documents,
        embedding=embeddings,
        persist_directory=DB_DIR
    )
    print("Runbook database populated successfully!")

if __name__ == "__main__":
    populate_runbooks_db()
