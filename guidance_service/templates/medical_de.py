"""Medical Document Extraction Templates.

Guidance templates for extracting medical data from German documents.
Handles:
- Classifier: document type classification
- Extractor: patient info, diagnoses (ICD-10), medications, lab values
- Integrator: harmonization of imaging and text data
- Tag suggestions and tagging metadata

Supports both basic and v2 (with tags) variants.
"""

import os
from typing import Any, Callable, List, Literal, Optional

from guidance import (  # type: ignore[import-not-found]
    assistant,
    gen_json,
    guidance,
    system,
    user,
)
from pydantic import BaseModel, Field, create_model

from templates.components.common import (
    build_domain_context,
    normalize_tags,
    pick_text,
    stringify,
)

TAG_SELECT_MAX = int(os.getenv("GUIDANCE_TAG_SELECT_MAX", "50"))
TAG_SUGGESTION_LIMIT = int(
    os.getenv("GUIDANCE_TAG_SUGGESTION_LIMIT", "5")
)
TAG_MISSING_LIMIT = int(os.getenv("GUIDANCE_TAG_MISSING_LIMIT", "5"))


class MedicalClassifierOutput(BaseModel):
    """Output schema for medical_classifier."""

    dokumenttyp: Literal[
        "Laborbefund",
        "Radiologiebericht",
        "Klinische Notiz",
        "Krankenkassenbeleg",
        "Sonstige",
    ]
    vertrauen: float = Field(ge=0, le=1)

    model_config = dict(extra="forbid")


class MedicalPatient(BaseModel):
    """Patient information."""

    name: str
    geburtsdatum: str

    model_config = dict(extra="forbid")


class MedicalDiagnosis(BaseModel):
    """Diagnosis with ICD-10 code."""

    icd10: str

    model_config = dict(extra="forbid")


class MedicalMedication(BaseModel):
    """Medication information."""

    name: str
    dosierung: str

    model_config = dict(extra="forbid")


class MedicalLabValue(BaseModel):
    """Laboratory test value."""

    name: str
    wert: str
    einheit: str

    model_config = dict(extra="forbid")


class MedicalExtractorOutput(BaseModel):
    """Output schema for medical_extractor."""

    patient: MedicalPatient
    diagnosen: List[MedicalDiagnosis]
    medikamente: List[MedicalMedication]
    laborwerte: List[MedicalLabValue]
    vertrauen: float = Field(ge=0, le=1)

    model_config = dict(extra="forbid")


class MedicalIntegratorOutput(BaseModel):
    """Output schema for medical_integrator."""

    primaerdiagnose: str

    model_config = dict(extra="forbid")


class TaggingTagConfidence(BaseModel):
    """Confidence score for individual tag."""

    tag: str
    confidence: float = Field(ge=0, le=1)

    model_config = dict(extra="forbid")


class TaggingConfidence(BaseModel):
    """Overall and per-tag confidence scores."""

    overall: float = Field(ge=0, le=1)
    tags: List[TaggingTagConfidence] = Field(
        default_factory=list
    )

    model_config = dict(extra="forbid")


class TaggingMetadata(BaseModel):
    """Metadata for tagging output."""

    domain: str
    source: str
    confidence: TaggingConfidence

    model_config = dict(extra="forbid")


def _build_tagged_schema(
    base_model: type[BaseModel],
    existing_tags: Optional[List[str]],
) -> type[BaseModel]:
    """Build dynamic Pydantic schema with tag constraints.

    Args:
        base_model: Base output model to extend
        existing_tags: List of allowed tags for selection

    Returns:
        Extended Pydantic model with tag fields
    """
    allowed_tags = list(
        dict.fromkeys(normalize_tags(existing_tags or []))
    )
    use_select = (
        allowed_tags and len(allowed_tags) <= TAG_SELECT_MAX
    )

    if use_select:
        # Create Literal type from allowed tags
        tag_literal = Literal[tuple(allowed_tags)]  # type: ignore
        suggested_type = List[tag_literal]  # type: ignore
    else:
        suggested_type = List[str]

    return create_model(
        f"{base_model.__name__}Tagged",
        suggested_tags=(
            suggested_type,
            Field(
                default_factory=list,
                max_items=TAG_SUGGESTION_LIMIT,
            ),
        ),
        missing_tags=(
            List[str],
            Field(default_factory=list, max_items=TAG_MISSING_LIMIT),
        ),
        tagging=(TaggingMetadata, ...),
        __base__=base_model,
    )


class MedicalTemplatesDE:
    """German-language medical extraction templates."""

    @staticmethod
    def get_medical_classifier() -> Callable:
        """Classify medical document type.

        Returns:
            Guidance template function for classification
        """

        @guidance
        def medical_classifier(
            lm: Any,
            document_text: Optional[str] = None,
            text_chunk: Optional[str] = None,
            domain: Optional[str] = None,
            existing_tags: Optional[List[str]] = None,
            model: Optional[str] = None,
            **kwargs: Any,
        ) -> Any:
            """Classify medical document."""
            text = pick_text(
                document_text,
                text_chunk,
                kwargs.get("medical_text"),
            )
            domain_context = build_domain_context(
                domain or kwargs.get("domain"),
                existing_tags or kwargs.get("existing_tags"),
                model or kwargs.get("model"),
                stats_context=(
                    kwargs.get("tag_stats_context")
                    or kwargs.get("stats_context")
                ),
            )

            with system():
                lm += (
                    "Du bist ein medizinischer "
                    "Dokumentklassifizierer. "
                    "Antworte nur mit JSON."
                )
                if domain_context:
                    lm += f"\n{domain_context}"

            with user():
                lm += f"Dokumenttext: {text}\n"
                lm += (
                    "Klassifiziere in: Laborbefund, "
                    "Radiologiebericht, Klinische Notiz, "
                    "Krankenkassenbeleg, Sonstige"
                )

            with assistant():
                lm += gen_json(
                    name="output",
                    schema=MedicalClassifierOutput,
                )

            return lm

        return medical_classifier

    @staticmethod
    def get_medical_extractor() -> Callable:
        """Extract medical data from document.

        Returns:
            Guidance template function for extraction
        """

        @guidance
        def medical_extractor(
            lm: Any,
            medical_text: Optional[str] = None,
            text_chunk: Optional[str] = None,
            domain: Optional[str] = None,
            existing_tags: Optional[List[str]] = None,
            model: Optional[str] = None,
            **kwargs: Any,
        ) -> Any:
            """Extract medical data."""
            text = pick_text(
                medical_text,
                text_chunk,
                kwargs.get("document_text"),
            )
            domain_context = build_domain_context(
                domain or kwargs.get("domain"),
                existing_tags or kwargs.get("existing_tags"),
                model or kwargs.get("model"),
                stats_context=(
                    kwargs.get("tag_stats_context")
                    or kwargs.get("stats_context")
                ),
            )

            with system():
                lm += (
                    "Du bist ein medizinischer "
                    "Datenextraktionist für deutschsprachige "
                    "Dokumente. "
                    "Antworte nur mit JSON."
                )
                if domain_context:
                    lm += f"\n{domain_context}"

            with user():
                lm += f"Medizinischer Text: {text}\n"
                lm += (
                    "Extrahiere: Patient, Diagnosen "
                    "(ICD-10), Medikamente, Laborwerte."
                )

            with assistant():
                lm += gen_json(
                    name="output",
                    schema=MedicalExtractorOutput,
                )

            return lm

        return medical_extractor

    @staticmethod
    def get_medical_integrator() -> Callable:
        """Integrate imaging and text data.

        Returns:
            Guidance template function for integration
        """

        @guidance
        def medical_integrator(
            lm: Any,
            imaging_analysis: Optional[str] = None,
            text_extraction: Optional[str] = None,
            prior_context: Optional[str] = None,
            domain: Optional[str] = None,
            existing_tags: Optional[List[str]] = None,
            model: Optional[str] = None,
            **kwargs: Any,
        ) -> Any:
            """Integrate imaging and text data."""
            imaging_text = stringify(
                pick_text(
                    imaging_analysis,
                    kwargs.get("imaging"),
                )
            )
            text_text = stringify(
                pick_text(text_extraction, kwargs.get("text"))
            )
            prior_text = stringify(
                pick_text(prior_context, kwargs.get("context"))
            )
            domain_context = build_domain_context(
                domain or kwargs.get("domain"),
                existing_tags or kwargs.get("existing_tags"),
                model or kwargs.get("model"),
                stats_context=(
                    kwargs.get("tag_stats_context")
                    or kwargs.get("stats_context")
                ),
            )

            with system():
                lm += "Harmonisiere Bild- und Textdaten."
                if domain_context:
                    lm += f"\n{domain_context}"

            with user():
                lm += f"Bild: {imaging_text} Text: {text_text}"
                if prior_text:
                    lm += f" Kontext: {prior_text}"

            with assistant():
                lm += gen_json(
                    name="output",
                    schema=MedicalIntegratorOutput,
                )

            return lm

        return medical_integrator

    @staticmethod
    def get_medical_integrator_v2() -> Callable:
        """Integrate data + tag suggestions (v2).

        Returns:
            Guidance template function for integration with tagging
        """

        @guidance
        def medical_integrator_v2(
            lm: Any,
            imaging_analysis: Optional[str] = None,
            text_extraction: Optional[str] = None,
            prior_context: Optional[str] = None,
            domain: Optional[str] = None,
            existing_tags: Optional[List[str]] = None,
            model: Optional[str] = None,
            **kwargs: Any,
        ) -> Any:
            """Integrate data and suggest tags."""
            imaging_text = stringify(
                pick_text(
                    imaging_analysis,
                    kwargs.get("imaging"),
                )
            )
            text_text = stringify(
                pick_text(text_extraction, kwargs.get("text"))
            )
            prior_text = stringify(
                pick_text(prior_context, kwargs.get("context"))
            )
            existing_tag_list = normalize_tags(
                existing_tags or kwargs.get("existing_tags")
            )
            tag_schema = _build_tagged_schema(
                MedicalIntegratorOutput,
                existing_tag_list,
            )
            domain_context = build_domain_context(
                domain or kwargs.get("domain"),
                existing_tag_list,
                model or kwargs.get("model"),
                stats_context=(
                    kwargs.get("tag_stats_context")
                    or kwargs.get("stats_context")
                ),
            )

            with system():
                lm += "Harmonisiere Bild- und Textdaten."
                lm += (
                    "\nZusätzlich: gib Tag-Vorschläge im "
                    "Tagging-Schema zurück. "
                    "suggested_tags nur aus bestehenden Tags, "
                    "missing_tags für neue Kandidaten. "
                    "tagging.domain='medical', "
                    "tagging.source='guidance_tagger_v2', "
                    "tagging.confidence.overall zwischen "
                    "0 und 1."
                )
                if domain_context:
                    lm += f"\n{domain_context}"

            with user():
                lm += f"Bild: {imaging_text} Text: {text_text}"
                if prior_text:
                    lm += f" Kontext: {prior_text}"

            with assistant():
                lm += gen_json(
                    name="output",
                    schema=tag_schema,
                )

            return lm

        return medical_integrator_v2
