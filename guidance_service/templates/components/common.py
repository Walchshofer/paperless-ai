from guidance import guidance, gen


def pick_text(*values):
    for value in values:
        if value not in (None, "", "N/A"):
            return value
    return ""


def stringify(value):
    if value in (None, "N/A"):
        return ""
    if isinstance(value, str):
        return value
    return str(value)


def normalize_tags(existing_tags):
    if not existing_tags:
        return []
    normalized = []
    for tag in existing_tags:
        if not tag:
            continue
        if isinstance(tag, str):
            text = tag.strip()
        elif isinstance(tag, dict) and tag.get("name"):
            text = str(tag.get("name")).strip()
        else:
            text = None
        if text:
            normalized.append(text)
    return normalized


def build_domain_context(
    domain=None,
    existing_tags=None,
    model_name=None,
    stats_context=None,
):
    parts = []
    if domain:
        parts.append(f"Domain: {domain}.")
    tag_list = normalize_tags(existing_tags)
    if tag_list:
        parts.append(f"Existing tags: {', '.join(tag_list)}.")
    if model_name:
        parts.append(f"Model: {model_name}.")
    if stats_context:
        parts.append(str(stats_context))
    return " ".join(parts)


@guidance(stateless=True)
def confidence_block(lm):
    lm += '"confidence": ' + gen("conf", regex=r"0(?:\.\d+)?|1(?:\.0+)?")
    return lm


@guidance(stateless=True)
def tag_entry(lm, tag_str, domain):
    lm += '{"tag": "' + str(tag_str) + '", "domain": "' + str(domain) + '", '   
    lm += confidence_block()
    lm += '}'
    return lm
