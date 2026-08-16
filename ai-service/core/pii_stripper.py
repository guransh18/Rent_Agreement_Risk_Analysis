from presidio_analyzer import AnalyzerEngine
from presidio_anonymizer import AnonymizerEngine

analyzer = AnalyzerEngine()
anonymizer = AnonymizerEngine()

def strip_pii(text: str) -> str:
    results = analyzer.analyze(
        text=text,
        entities=[
            "PERSON",
            "PHONE_NUMBER",
            "EMAIL_ADDRESS",
            "LOCATION",
            "IN_PAN",
            "IN_AADHAAR",
        ],
        language="en"
    )
    anonymized = anonymizer.anonymize(text=text, analyzer_results=results)
    return anonymized.text