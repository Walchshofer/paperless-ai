from .regex_fsm import RegexFSM

class LogitBiasEngine:
    """
    The Core Engine that wraps the FSM and formats for gRPC.
    """
    def __init__(self, tokenizer):
        self.fsm = RegexFSM(tokenizer)
        # Tuning parameters
        self.BIAS_VALID = 100.0
        self.BIAS_INVALID = -100.0

    def compute_biases(
        self,
        regex_pattern: str,
        generated_text: str,
        vocab_size: int,
    ):
        valid_tokens = self.fsm.get_valid_tokens(regex_pattern, generated_text)

        # Construct the sparse bias map
        biases = {}
        for token_id in valid_tokens:
            biases[token_id] = self.BIAS_VALID

        return biases, len(valid_tokens)