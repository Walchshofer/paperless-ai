"""Pydantic v2 schema for document geometry normalization.

Defines the NormalizationGeometry schema for constrained JSON
generation in Guidance templates. All fields are validated at
token level by Guidance and semantically by Pydantic.

Best Practices Applied:
- Pydantic v2 ConfigDict (not deprecated Config class)
- Comprehensive Field descriptions
- Strict validation with extra="forbid"
- Type hints and constraints
"""

from typing import List, Optional

from pydantic import BaseModel, Field, ConfigDict


class NormalizationGeometry(BaseModel):
    """Guidance-constrained normalization geometry analysis.

    Represents the geometric analysis results for document
    normalization: rotation angle, cropping region, and DPI
    requirements. All fields are token-level constrained during
    generation and semantically validated post-generation.

    Attributes:
        rotate: Clockwise rotation in 90° increments
        needs_crop: Whether cropping is necessary
        crop_box: Normalized crop coordinates [xmin, ymin, xmax, ymax]
        target_dpi: Recommended DPI for reconstruction
        confidence: Confidence score for the entire analysis
        reasoning: Explanation of analysis decisions
    """

    rotate: int = Field(
        description="Clockwise rotation (0, 90, 180, or 270 degrees)",
        ge=0,
        le=270,
        multiple_of=90,
    )

    needs_crop: bool = Field(
        description="Whether document should be cropped"
    )

    crop_box: Optional[List[int]] = Field(
        default=None,
        description=(
            "Normalized crop coordinates [xmin, ymin, xmax, ymax] "
            "in 0-1000 scale. Only present if needs_crop is True"
        ),
    )

    target_dpi: Optional[int] = Field(
        default=None,
        description=(
            "Recommended DPI (200-400) for reconstruction, "
            "or null if current DPI is acceptable"
        ),
        ge=200,
        le=400,
    )

    confidence: float = Field(
        description=(
            "Confidence score for the entire analysis "
            "(0.0-1.0, where 1.0 is highest confidence)"
        ),
        ge=0.0,
        le=1.0,
    )

    reasoning: str = Field(
        description="Brief explanation of analysis decisions",
        max_length=200,
    )

    # Pydantic v2: Use model_config instead of deprecated Config class
    model_config = ConfigDict(
        extra="forbid",  # Reject unknown fields
        json_schema_extra={
            "examples": [
                {
                    "rotate": 0,
                    "needs_crop": False,
                    "crop_box": None,
                    "target_dpi": 300,
                    "confidence": 0.95,
                    "reasoning": (
                        "Document is properly oriented and has "
                        "acceptable quality"
                    ),
                },
                {
                    "rotate": 90,
                    "needs_crop": True,
                    "crop_box": [50, 100, 950, 900],
                    "target_dpi": 350,
                    "confidence": 0.87,
                    "reasoning": (
                        "Document is rotated 90° clockwise; "
                        "margins need removal"
                    ),
                },
            ]
        },
    )

    def validate_crop_box_if_needed(self) -> None:
        """Validate crop_box consistency with needs_crop.

        This is an optional business logic validator that can be
        called explicitly. It's not a Pydantic field validator,
        so it must be called manually if needed.

        Raises:
            ValueError: If crop_box is inconsistent with needs_crop
        """
        if self.needs_crop and self.crop_box is None:
            raise ValueError(
                "needs_crop is True but crop_box is None"
            )
        if not self.needs_crop and self.crop_box is not None:
            raise ValueError(
                "needs_crop is False but crop_box is provided"
            )

        if self.crop_box is not None:
            if len(self.crop_box) != 4:
                raise ValueError(
                    f"crop_box must have 4 elements, got {len(self.crop_box)}"
                )
            xmin, ymin, xmax, ymax = self.crop_box
            if not (0 <= xmin < xmax <= 1000):
                raise ValueError(
                    f"Invalid crop_box x coordinates: {xmin}, {xmax}"
                )
            if not (0 <= ymin < ymax <= 1000):
                raise ValueError(
                    f"Invalid crop_box y coordinates: {ymin}, {ymax}"
                )
