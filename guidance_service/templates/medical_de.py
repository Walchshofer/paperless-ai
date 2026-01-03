"""Medical Document Extraction Templates.

Guidance templates for extracting medical data from German documents.
Handles:
- Classifier: document type classification
- Extractor: patient info, diagnoses (ICD-10), medications, lab values
- Integrator: harmonization of imaging and text data
- Tag suggestions and tagging metadata

Supports basic, v2 (with tags), and integrator variants.

Best Practices Applied:
- Comprehensive logging and error handling
- Type annotations throughout
- Pydantic schema validation
- Clear docstrings for all functions
"""

import logging
import os
from typing import Any, Callable, List, Literal, Optional

try:
    from guidance import (  # type: ignore[import-not-found]
        assistant,
        json as gen_json,
        guidance,
        system,
        user,
    )
except ImportError:
    # Guidance not available in the local environment (tests run here).
    # It will be present in the Docker image at runtime; avoid raising at import.
    assistant = None  # type: ignore[assignment]
    gen_json = None  # type: ignore[assignment]
    guidance = None  # type: ignore[assignment]
    system = None  # type: ignore[assignment]
    user = None  # type: ignore[assignment]
    GUIDANCE_AVAILABLE = False

from pydantic import BaseModel, Field, create_model

from templates.components.common import (
    build_domain_context,
    normalize_tags,
    pick_text,
    stringify,
)

# Configure logging
logger = logging.getLogger(__name__)

# Configuration from environment
TAG_SELECT_MAX = int(os.getenv("GUIDANCE_TAG_SELECT_MAX", "50"))
TAG_SUGGESTION_LIMIT = int(
    os.getenv("GUIDANCE_TAG_SUGGESTION_LIMIT", "5")
)
TAG_MISSING_LIMIT = int(os.getenv("GUIDANCE_TAG_MISSING_LIMIT", "5"))


# ============================================================================
# Output Schemas - Pydantic Models
# ============================================================================


class MedicalClassifierOutput(BaseModel):
    """Output schema for medical_classifier.

    Attributes:
        dokumenttyp: Type of medical document
        vertrauen: Confidence score (0-1)
    """

    dokumenttyp: Literal[
        "Laborbefund",
        "Radiologiebericht",
        "Klinische Notiz",
        "Krankenkassenbeleg",
        "Sonstige",
    ]
    vertrauen: float = Field(
        ge=0, le=1, description="Confidence score"
    )

    model_config = dict(extra="forbid")


class MedicalPatient(BaseModel):
    """Patient information.

    Attributes:
        name: Patient full name
        geburtsdatum: Date of birth (YYYY-MM-DD)
    """

    name: str
    geburtsdatum: str

    model_config = dict(extra="forbid")


class MedicalDiagnosis(BaseModel):
    """Diagnosis with ICD-10 code.

    Attributes:
        icd10: ICD-10 diagnosis code (e.g., A01.0)
    """

    icd10: str

    model_config = dict(extra="forbid")


class MedicalMedication(BaseModel):
    """Medication information.

    Attributes:
        name: Medication name
        dosierung: Dosage (e.g., "500mg täglich")
    """

    name: str
    dosierung: str

    model_config = dict(extra="forbid")


class MedicalLabValue(BaseModel):
    """Laboratory test value.

    Attributes:
        name: Test name (e.g., "Hemoglobin")
        wert: Measured value
        einheit: Unit of measurement (e.g., "g/dL")
    """

    name: str
    wert: str
    einheit: str

    model_config = dict(extra="forbid")


class MedicalExtractorOutput(BaseModel):
    """Output schema for medical_extractor.

    Attributes:
        patient: Patient information
        diagnosen: List of diagnoses with ICD-10 codes
        medikamente: List of medications
        laborwerte: List of laboratory values
        vertrauen: Confidence score (0-1)
    """

    patient: MedicalPatient
    diagnosen: List[MedicalDiagnosis]
    medikamente: List[MedicalMedication]
    laborwerte: List[MedicalLabValue]
    vertrauen: float = Field(
        ge=0, le=1, description="Confidence score"
    )

    model_config = dict(extra="forbid")


class MedicalIntegratorOutput(BaseModel):
    """Output schema for medical_integrator.

    Attributes:
        primaerdiagnose: Primary diagnosis from integrated data
    """

    primaerdiagnose: str

    model_config = dict(extra="forbid")


class TaggingTagConfidence(BaseModel):
    """Confidence score for individual tag.

    Attributes:
        tag: Tag identifier
        confidence: Confidence score (0-1)
    """

    tag: str
    confidence: float = Field(ge=0, le=1)

    model_config = dict(extra="forbid")


class TaggingConfidence(BaseModel):
    """Overall and per-tag confidence scores.

    Attributes:
        overall: Overall confidence score
        tags: Per-tag confidence scores
    """

    overall: float = Field(ge=0, le=1)
    tags: List[TaggingTagConfidence] = Field(
        default_factory=list
    )

    model_config = dict(extra="forbid")


class TaggingMetadata(BaseModel):
    """Metadata for tagging output.

    Attributes:
        domain: Domain identifier
        source: Source of tagging
        confidence: Confidence scores
    """

    domain: str
    source: str
    confidence: TaggingConfidence

    model_config = dict(extra="forbid")


# ============================================================================
# Helper Functions
# ============================================================================


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

    Raises:
        ValueError: If tag normalization fails
    """
    try:
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
            logger.debug(
                f"Using Literal constraint for {len(allowed_tags)} tags"
            )
        else:
            suggested_type = List[str]
            logger.debug(
                f"Using unconstrained List[str] "
                f"for {len(allowed_tags)} tags"
            )

        tagged_model = create_model(
            f"{base_model.__name__}Tagged",
            suggested_tags=(
                suggested_type,
                Field(
                    default_factory=list,
                    max_items=TAG_SUGGESTION_LIMIT,
                    description="Suggested tags from existing tags",
                ),
            ),
            missing_tags=(
                List[str],
                Field(
                    default_factory=list,
                    max_items=TAG_MISSING_LIMIT,
                    description="New tag candidates",
                ),
            ),
            tagging=(
                TaggingMetadata,
                Field(description="Tagging metadata and confidence"),
            ),
            __base__=base_model,
        )

        return tagged_model

    except Exception as e:
        logger.error(f"Failed to build tagged schema: {e}")
        raise


# ============================================================================
# Guidance Templates
# ============================================================================


class MedicalTemplatesDE:
    """German-language medical extraction templates.

    This class provides reusable Guidance templates for extracting and
    analyzing medical documents in German contexts.

    Each template is decorated with @guidance and returns a callable that
    can be used with Guidance language models.
    """

    @staticmethod
    def get_medical_classifier() -> Callable:
        """Classify medical document type.

        Returns:
            Guidance template function for classification

        Example:
            >>> classifier = (
            ...     MedicalTemplatesDE.get_medical_classifier()
            ... )
            >>> lm = model + classifier(
            ...     document_text="Laborbefund vom..."
            ... )
            >>> result = lm["output"]
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
            """Classify medical document.

            Args:
                lm: Language model instance
                document_text: Full document text
                text_chunk: Alternative text parameter
                domain: Domain context
                existing_tags: Existing tags for context
                model: Model identifier
                **kwargs: Additional arguments

            Returns:
                Updated language model with classification result
            """
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

            logger.debug(
                f"Classifying medical document from domain: {domain}"
            )

            with system():
                lm += (
                    "Du bist ein medizinischer "
                    "Dokumentklassifizierer."
                )
                lm += "Antworte nur mit JSON."
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

        Example:
            >>> extractor = (
            ...     MedicalTemplatesDE.get_medical_extractor()
            ... )
            >>> lm = model + extractor(
            ...     medical_text="Laborbefund..."
            ... )
            >>> result = lm["output"]
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
            """Extract medical data.

            Args:
                lm: Language model instance
                medical_text: Medical document text
                text_chunk: Alternative text parameter
                domain: Domain context
                existing_tags: Existing tags for context
                model: Model identifier
                **kwargs: Additional arguments

            Returns:
                Updated language model with extraction result
            """
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

            logger.debug(
                f"Extracting medical data from domain: {domain}"
            )

            with system():
                lm += (
                    "Du bist ein medizinischer "
                    "Datenextraktionist für deutschsprachige "
                    "Dokumente."
                )
                lm += "Antworte nur mit JSON."
                if domain_context:
                    lm += f"\n{domain_context}"

            with user():
                lm += f"Medizinischer Text: {text}\n"
                lm += (
                    "Extrahiere: Patient, Diagnosen (ICD-10), "
                    "Medikamente, Laborwerte."
                )

            with assistant():
                lm += gen_json(
                    name="output",
                    schema=MedicalExtractorOutput,
                )

            return lm

        return medical_extractor

    @staticmethod
    def get_medical_extractor_v2() -> Callable:
        """Extract medical data + tag suggestions (v2).

        Returns:
            Guidance template function for extraction with tagging

        Example:
            >>> extractor_v2 = (
            ...     MedicalTemplatesDE.get_medical_extractor_v2()
            ... )
            >>> lm = model + extractor_v2(
            ...     medical_text="Laborbefund...",
            ...     existing_tags=["labor", "blutbild"]
            ... )
            >>> result = lm["output"]
        """

        @guidance
        def medical_extractor_v2(
            lm: Any,
            medical_text: Optional[str] = None,
            text_chunk: Optional[str] = None,
            domain: Optional[str] = None,
            existing_tags: Optional[List[str]] = None,
            model: Optional[str] = None,
            **kwargs: Any,
        ) -> Any:
            """Extract medical data and suggest tags.

            Args:
                lm: Language model instance
                medical_text: Medical document text
                text_chunk: Alternative text parameter
                domain: Domain context
                existing_tags: Tags for constraining suggestions
                model: Model identifier
                **kwargs: Additional arguments

            Returns:
                Updated language model with extraction and tags
            """
            text = pick_text(
                medical_text,
                text_chunk,
                kwargs.get("document_text"),
            )
            existing_tag_list = normalize_tags(
                existing_tags or kwargs.get("existing_tags")
            )

            try:
                tag_schema = _build_tagged_schema(
                    MedicalExtractorOutput,
                    existing_tag_list,
                )
            except Exception as e:
                logger.error(f"Failed to build tag schema: {e}")
                tag_schema = MedicalExtractorOutput

            domain_context = build_domain_context(
                domain or kwargs.get("domain"),
                existing_tag_list,
                model or kwargs.get("model"),
                stats_context=(
                    kwargs.get("tag_stats_context")
                    or kwargs.get("stats_context")
                ),
            )

            logger.debug(
                f"Extracting medical data with tagging from domain: "
                f"{domain}, tags: {len(existing_tag_list)}"
            )

            with system():
                lm += (
                    "Du bist ein medizinischer "
                    "Datenextraktionist für deutschsprachige "
                    "Dokumente."
                )
                lm += "Antworte nur mit JSON.\n"
                lm += (
                    "Gib auch Tag-Vorschläge im Tagging-Schema zurück."
                )
                lm += (
                    "\nTagging-Regeln:\n"
                    "- suggested_tags: nur aus bestehenden Tags\n"
                    "- missing_tags: neue Tag-Kandidaten\n"
                    "- tagging.domain: 'medical'\n"
                    "- tagging.source: 'guidance_tagger_v2'\n"
                    "- tagging.confidence.overall: zwischen 0 und 1"
                )
                if domain_context:
                    lm += f"\n{domain_context}"

            with user():
                lm += f"Medizinischer Text: {text}\n"
                lm += (
                    "Extrahiere: Patient, Diagnosen (ICD-10), "
                    "Medikamente, Laborwerte, Tags."
                )

            with assistant():
                lm += gen_json(
                    name="output",
                    schema=tag_schema,
                )

            return lm

        return medical_extractor_v2

    @staticmethod
    def get_medical_integrator() -> Callable:
        """Integrate imaging and text data.

        Returns:
            Guidance template function for integration

        Example:
            >>> integrator = (
            ...     MedicalTemplatesDE.get_medical_integrator()
            ... )
            >>> lm = model + integrator(
            ...     imaging_analysis="CT zeigt...",
            ...     text_extraction="Klinische Diagnose..."
            ... )
            >>> result = lm["output"]
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
            """Integrate imaging and text data.

            Args:
                lm: Language model instance
                imaging_analysis: Imaging analysis text
                text_extraction: Clinical text data
                prior_context: Prior medical context
                domain: Domain context
                existing_tags: Existing tags
                model: Model identifier
                **kwargs: Additional arguments

            Returns:
                Updated language model with integration result
            """
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

            logger.debug("Integrating imaging and text data")

            with system():
                lm += (
                    "Harmonisiere Bild- und Textdaten "
                    "zu einer integrierten Diagnose."
                )
                if domain_context:
                    lm += f"\n{domain_context}"

            with user():
                lm += f"Bildanalyse: {imaging_text}\n"
                lm += f"Klinischer Text: {text_text}"
                if prior_text:
                    lm += f"\nPrior-Kontext: {prior_text}"

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

        Example:
            >>> integrator_v2 = (
            ...     MedicalTemplatesDE.get_medical_integrator_v2()
            ... )
            >>> lm = model + integrator_v2(
            ...     imaging_analysis="CT zeigt...",
            ...     text_extraction="Diagnose...",
            ...     existing_tags=["ct", "diagnose"]
            ... )
            >>> result = lm["output"]
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
            """Integrate data and suggest tags.

            Args:
                lm: Language model instance
                imaging_analysis: Imaging analysis text
                text_extraction: Clinical text data
                prior_context: Prior medical context
                domain: Domain context
                existing_tags: Tags for constraining suggestions
                model: Model identifier
                **kwargs: Additional arguments

            Returns:
                Updated language model with integration and tags
            """
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

            try:
                tag_schema = _build_tagged_schema(
                    MedicalIntegratorOutput,
                    existing_tag_list,
                )
            except Exception as e:
                logger.error(f"Failed to build tag schema: {e}")
                tag_schema = MedicalIntegratorOutput

            domain_context = build_domain_context(
                domain or kwargs.get("domain"),
                existing_tag_list,
                model or kwargs.get("model"),
                stats_context=(
                    kwargs.get("tag_stats_context")
                    or kwargs.get("stats_context")
                ),
            )

            logger.debug(
                f"Integrating imaging and text data with tagging, "
                f"tags: {len(existing_tag_list)}"
            )

            with system():
                lm += (
                    "Harmonisiere Bild- und Textdaten "
                    "zu einer integrierten Diagnose."
                )
                lm += "\n"
                lm += (
                    "Gib auch Tag-Vorschläge im Tagging-Schema zurück."
                )
                lm += (
                    "\nTagging-Regeln:\n"
                    "- suggested_tags: nur aus bestehenden Tags\n"
                    "- missing_tags: neue Tag-Kandidaten\n"
                    "- tagging.domain: 'medical'\n"
                    "- tagging.source: 'guidance_tagger_v2'\n"
                    "- tagging.confidence.overall: zwischen 0 und 1"
                )
                if domain_context:
                    lm += f"\n{domain_context}"

            with user():
                lm += f"Bildanalyse: {imaging_text}\n"
                lm += f"Klinischer Text: {text_text}"
                if prior_text:
                    lm += f"\nPrior-Kontext: {prior_text}"

            with assistant():
                lm += gen_json(
                    name="output",
                    schema=tag_schema,
                )

            return lm

        return medical_integrator_v2
