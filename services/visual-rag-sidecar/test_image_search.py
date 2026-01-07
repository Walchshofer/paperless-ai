import base64
import json
import requests
import sys

def test_image_search():
    # 1. Create a dummy small red image (1x1 pixel)
    # 1x1 red pixel PNG
    red_pixel_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    
    url = "http://localhost:8001/search"
    
    payload = {
        "query_image": red_pixel_b64,
        "k": 1,
        "include_base64": False
    }
    
    print(f"Sending request to {url} with base64 image...")
    
    try:
        response = requests.post(url, json=payload)
        
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("Response JSON:")
            print(json.dumps(response.json(), indent=2))
            print("\nSUCCESS: Image search endpoint accepted the request.")
        else:
            print("Response Text:")
            print(response.text)
            print("\nFAILURE: Endpoint returned error.")
            
    except requests.exceptions.ConnectionError:
        print("\nFAILURE: Could not connect to visual-rag-sidecar at localhost:8001.")
        print("Ensure the service is running (e.g. via docker-compose or python main.py).")
        sys.exit(1)

if __name__ == "__main__":
    test_image_search()
