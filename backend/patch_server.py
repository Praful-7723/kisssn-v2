import os

file_path = "server.py"
with open(file_path, "r") as f:
    code = f.read()

# Replace block 1: estimate_soil
code = code.replace(
"""        from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
        chat = LlmChat(
            session_id=f"soil_analyze_{uuid.uuid4().hex[:8]}",
            system_message="You are an expert soil scientist. Analyze the soil image and provide: soil_type, estimated_ph_range (min-max), texture, color_description, moisture_level, and recommendations. Respond ONLY in valid JSON format."
        )
        chat.with_model("google", "gemini-1.5-flash")
        image_content = ImageContent(image_base64=image_b64)
        response = await chat.send_message(UserMessage(
            text="Analyze this soil image. Determine the soil type, estimate pH range, describe texture and moisture. Respond in JSON.",
            images=[image_content]
        ))""",
"""        from ai_helpers import gemini_chat
        sys_msg = "You are an expert soil scientist. Analyze the soil image and provide: soil_type, estimated_ph_range (min-max), texture, color_description, moisture_level, and recommendations. Respond ONLY in valid JSON format."
        user_msg = "Analyze this soil image. Determine the soil type, estimate pH range, describe texture and moisture. Respond in JSON."
        response = await gemini_chat(system_prompt=sys_msg, user_prompt=user_msg, image_b64=image_b64)
""")

# Actually wait, in `estimate_soil`, the parameter in UserMessage might be `image_contents` or `images`. Let's use a regex or more targeted replace for safety.
