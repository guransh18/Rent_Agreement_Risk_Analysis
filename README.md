# RentGuard

**Maharashtra Residential Rent Agreement Analyzer**

> A decoupled, AI-driven compliance engine and "bureaucracy translator" designed to parse, evaluate, and validate residential Leave and License agreements against the Maharashtra Rent Control Act, 1999 (MRCA 1999) and Inspector General of Registration (IGR) standards.

## 📖 Project Overview

RentGuard automates the legal review process for residential rental contracts in Maharashtra. By leveraging Natural Language Processing (NLP) and Retrieval-Augmented Generation (RAG), the system identifies predatory clauses, highlights statutory discrepancies, and calculates an aggregate risk score for unexecuted drafts.

Built with a privacy-first **Zero Retention** architecture, RentGuard ensures that highly sensitive PII and contract data are processed ephemerally in-memory and never written to a persistent database.

## ⚙️ System Architecture & Tech Stack

The application operates on a decoupled microservices architecture, separating the client presentation layer, I/O orchestration, and computationally heavy inference tasks.

* **Presentation Layer (Client):** `React` | `Vite`
* A Single Page Application (SPA) handling client-side state management, multipart file uploads, and dynamic rendering of compliance badges and JSON analysis payloads.


* **Orchestration Layer (API Gateway):** `Node.js` | `Express`
* Acts as the Backend-for-Frontend (BFF). It multiplexes network traffic, manages CORS policies, and streams document buffers to the AI engine without blocking the main event loop.


* **Analytical Inference Engine (AI Service):** `Python` | `FastAPI` | `Uvicorn`
* The core computational microservice. Handles asynchronous request resolution, optical character recognition (OCR), text extraction, and the execution of the RAG pipeline for schema validation.



## 🔄 System Lifecycle (How It Works)

1. **Ingestion:** The user uploads an unexecuted rent agreement (PDF). The payload is transmitted via a multipart stream through the API Gateway.
2. **Ephemeral Processing:** The AI microservice extracts the document text entirely in-memory.
3. **Entity & Anomaly Detection:** The engine isolates critical commercial variables (e.g., security deposits, lock-in periods, rent escalation, maintenance liabilities).
4. **Resolution:** The application calculates a risk score (out of 10) and flags specific deviations from legal baselines. If a document is deemed hazardous, the system provides a sanitized, IGR-compliant template for download.

## 🧠 RAG (Retrieval-Augmented Generation) Implementation

To prevent the LLM from hallucinating legal advice, RentGuard grounds its evaluations in deterministic statutory truth using a RAG pipeline:

* **Contextual Chunking:** The uploaded document is parsed and segmented logically by contract clauses (e.g., "Termination", "Deposit").
* **Statutory Retrieval:** The engine queries a specialized vector knowledge base containing official texts from the MRCA 1999 and the IGR Maharashtra standard templates.
* **Augmented Synthesis:** The LLM is prompted with both the *extracted user clause* and the *retrieved statutory baseline*.
* **Deterministic Output:** By forcing a direct contextual comparison, the AI accurately identifies legal deviations and generates a highly explainable, strictly formatted JSON response detailing the violations.
