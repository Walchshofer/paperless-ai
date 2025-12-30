"""Medical Document Extraction Validator.

Validates outputs from medical_classifier and medical_extractor
templates. Handles patient data, diagnoses, medications, and lab
values with German schema alignment.

Handles:
- dokumenttyp: Laborbefund, Radiologiebericht, Klinische Notiz,
  Krankenkassenbeleg, Sonstige
- primaerdiagnose: Primary diagnosis with ICD-10 coding
- patient: name, geburtsdatum (YYYY-MM-DD)
- diagnosen: list of diagnosis objects with ICD-10 codes
- medikamente: list of medications
- laborwerte: list of lab values
- Tag suggestions and tagging metadata
"""

import re
from typing import Any, Dict, List


def validate_medical_extraction(
    data: Dict[str, Any],
) -> Dict[str, Any]:
    """Validate output from medical_extractor template.

    Handles multiple extraction scenarios:
    - dokumenttyp-based classification
    - primaerdiagnose (single diagnosis)
    - Full patient record with multiple diagnoses

    Args:
        data: Extraction result from Guidance template

    Returns:
        Dict with keys:
            - valid (bool): True if no errors
            - errors (List[str]): Critical validation failures
            - warnings (List[str]): Non-critical issues
    """
    errors: List[str] = []
    warnings: List[str] = []

    try:
        if not data or not isinstance(data, dict):
            return {
                "valid": False,
                "errors": ["Empty extraction result"],
                "warnings": warnings,
            }

        if "dokumenttyp" in data:
            doc_type = data.get("dokumenttyp", "")
            valid_types = [
                "Laborbefund",
                "Radiologiebericht",
                "Klinische Notiz",
                "Krankenkassenbeleg",
                "Sonstige",
            ]
            if doc_type and doc_type not in valid_types:
                warnings.append(
                    f"Document type '{doc_type}' not in "
                    f"standard list"
                )
        elif "primaerdiagnose" in data:
            if not data.get("primaerdiagnose"):
                warnings.append(
                    "Primary diagnosis (primaerdiagnose) "
                    "is missing"
                )
        else:
            patient = data.get("patient", {})
            if not patient or not patient.get("name"):
                errors.append("Patient name missing")

            dob = (
                patient.get("geburtsdatum")
                if isinstance(patient, dict)
                else None
            )
            if (
                dob
                and not re.match(r"^\d{4}-\d{2}-\d{2}$", dob)
            ):
                warnings.append(
                    f"Invalid date format (geburtsdatum): {dob}"
                )

            diagnoses = data.get("diagnosen", [])
            if not isinstance(diagnoses, list):
                errors.append("Diagnosen must be a list")
            else:
                for dx in diagnoses:
                    if not isinstance(dx, dict):
                        warnings.append(
                            "Diagnosis entry is not an object"
                        )
                        continue
                    icd10 = dx.get("icd10")
                    if (
                        icd10
                        and not re.match(
                            r"^[A-Z]\d{2}(\.[A-Z0-9]{1,4})?$",
                            icd10,
                        )
                    ):
                        warnings.append(f"Invalid ICD-10: {icd10}")

            for field in ["medikamente", "laborwerte"]:
                value = data.get(field)
                if value is not None and not isinstance(
                    value,
                    list,
                ):
                    errors.append(f"{field} must be a list")

        confidence = data.get("vertrauen")
        if confidence is not None:
            try:
                conf_val = float(confidence)
                if not (0.0 <= conf_val <= 1.0):
                    warnings.append(
                        f"Confidence score out of range: "
                        f"{confidence}"
                    )
            except (ValueError, TypeError):
                errors.append(
                    f"Invalid confidence format: {confidence}"
                )

        _validate_tag_fields(data, warnings, errors, "medical")

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
        }

    except Exception as e:
        return {
            "valid": False,
            "errors": [str(e)],
            "warnings": warnings,
        }


def _validate_tag_fields(
    data: Dict[str, Any],
    warnings: List[str],
    errors: List[str],
    domain: str,
) -> None:
    """Validate tagging fields (suggested_tags, missing_tags, etc.).

    Args:
        data: Extraction result
        warnings: Warnings list (mutated)
        errors: Errors list (mutated)
        domain: Expected domain ("medical", "legal", etc.)
    """
    suggested = data.get("suggested_tags")
    if suggested is not None and not isinstance(suggested, list):
        errors.append("suggested_tags must be a list")
    elif isinstance(suggested, list):
        if any(not isinstance(tag, str) for tag in suggested):
            warnings.append(
                "suggested_tags contains non-string entries"
            )

    missing = data.get("missing_tags")
    if missing is not None and not isinstance(missing, list):
        errors.append("missing_tags must be a list")
    elif isinstance(missing, list):
        if any(not isinstance(tag, str) for tag in missing):
            warnings.append(
                "missing_tags contains non-string entries"
            )

    tagging = data.get("tagging")
    if tagging is None:
        return

    if not isinstance(tagging, dict):
        warnings.append("tagging must be an object")
        return

    tag_domain = tagging.get("domain")
    if tag_domain and str(tag_domain).lower() != domain:
        warnings.append(
            f"tagging.domain '{tag_domain}' does not match "
            f"'{domain}'"
        )

    if not tagging.get("source"):
        warnings.append("tagging.source is missing")

    confidence = tagging.get("confidence")
    if confidence is None:
        return

    if not isinstance(confidence, dict):
        warnings.append("tagging.confidence must be an object")
        return

    overall = confidence.get("overall")
    if overall is not None:
        try:
            value = float(overall)
            if value < 0 or value > 1:
                warnings.append(
                    f"tagging.confidence.overall out of range: "
                    f"{overall}"
                )
        except (TypeError, ValueError):
            warnings.append(
                "tagging.confidence.overall is not a number"
            )
