import re
import regex  # Use the 'regex' library for partial matching support
from typing import Set, Dict, Optional
import functools

class RegexFSM:
    """
    Implements the FSM logic to determine valid next tokens.
    Uses partial matching to simulate state transitions.
    """
    
    def __init__(self, tokenizer):
        self.tokenizer = tokenizer
        self.cache = {} # Simple in-memory cache

    @functools.lru_cache(maxsize=10000)
    def get_valid_tokens(self, regex_pattern: str, current_text: str) -> Set[int]:
        """
        Determines which tokens can validly extend 'current_text' 
        according to 'regex_pattern'.
        """
        valid_tokens = set()
        
        # Compile with partial matching flag
        try:
            pattern = regex.compile(regex_pattern)
        except Exception as e:
            return set()
        
        for token_id in range(self.tokenizer.vocab_size):
            try:
                token_str = self.tokenizer.decode([token_id])
            except:
                continue
                
            candidate = current_text + token_str
            
            # partial=True allows "12" to match "[0-9]{3}"
            match = pattern.fullmatch(candidate, partial=True)
            
            if match:
                valid_tokens.add(token_id)
                
        return valid_tokens