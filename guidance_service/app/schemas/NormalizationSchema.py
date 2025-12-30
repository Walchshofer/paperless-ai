from pydantic import BaseModel, Field
from typing import Optional, List


class NormalizationGeometry(BaseModel):
    """Guidance-constrained normalization geometry analysis"""

    rotate: int = Field(
        description="Clockwise rotation (0, 90, 180, or 270 degrees)",
        ge=0,
        le=270,
        multiple_of=90
    )

    needs_crop: bool = Field(
        description="Whether document should be cropped"
    )

    crop_box: Optional[List[int]] = Field(
        default=None,
        description=(
            "Normalized crop coordinates [xmin, ymin, xmax, ymax] "
            "in 0-1000 scale"
        )
    )

    target_dpi: Optional[int] = Field(
        default=None,
        description="Recommended DPI (200-400) or null",
        ge=200,
        le=400
    )

    confidence: float = Field(
        description="Confidence score",
        ge=0.0,
        le=1.0
    )

    reasoning: str = Field(
        description="Brief explanation of decisions",
        max_length=200
    )

    class Config:
        json_schema_extra = {
            "examples": [
                {
                    "rotate": 0,
                    "needs_crop": False,
                    "crop_box": None,
                    "target_dpi": 300,
                    "confidence": 0.95,
                    "reasoning": "Document is properly oriented"
                }
            ]
        }
