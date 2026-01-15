import sys

print("🔍 Verifying Native ColQwen3 Loading...")

try:
    import byaldi
    from byaldi import RAGMultiModalModel
    print(f"✅ Byaldi version: {byaldi.__version__}")
except ImportError:
    print("❌ Byaldi not installed.")
    sys.exit(1)

# The corrected model name from your environment
MODEL_NAME = "TomoroAI/tomoro-colqwen3-embed-4b-awq"

print(f"🔄 Attempting to load model: {MODEL_NAME}")
print("   (This checks for native support without registry injection)")

try:
    # Attempt to load without any custom registry hacks
    model = RAGMultiModalModel.from_pretrained(
        MODEL_NAME,
        verbose=1
    )
    print("\n🎉 SUCCESS: ColQwen3 model loaded natively!")
    print(f"   Model class: {type(model).__name__}")

except Exception as e:
    print("\n❌ FAILURE: Could not load model natively.")
    print(f"   Error: {e}")
    print("\nPossible causes:")
    print("   1. 'byaldi' version is too old (requires >=0.0.7)")
    print(
        "   2. Model name typo (ensure it is "
        "'TomoroAI/tomoro-colqwen3-embed-4b-awq')"
    )
    sys.exit(1)