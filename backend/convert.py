import re

with open("server.py", "r") as f:
    text = f.read()

# Replace motor imports
text = text.replace("from motor.motor_asyncio import AsyncIOMotorClient\n", "from supabase import create_client, Client\n")

# Replace MongoDB init
mongo_init = """# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]"""

supabase_init = """# Supabase connection
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')
db: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def _get_one(table, col, val):
    res = db.table(table).select("*").eq(col, val).execute()
    return res.data[0] if res.data else None"""

text = text.replace(mongo_init, supabase_init)

# Replace all simple find_ones
text = re.sub(r'await db\.([a-zA-Z_]+)\.find_one\(\{"([a-zA-Z_]+)": ([^}]+)\}, \{"_id": 0\}\)', r'_get_one("\1", "\2", \3)', text)

# Replace insert_one
text = re.sub(r'await db\.([a-zA-Z_]+)\.insert_one\((.*?)\)', r'db.table("\1").insert(\2).execute()', text)

# Replace update_one with $set
text = re.sub(r'await db\.([a-zA-Z_]+)\.update_one\(\{"([a-zA-Z_]+)": ([^}]+)\}, \{"\$set": (.*?)\}\)', r'db.table("\1").update(\4).eq("\2", \3).execute()', text)

# Replace update_one with $push / $pull
text = re.sub(r'await db\.community_posts\.update_one\(\s*\{"post_id": post_id\},\s*\{"\$pull": \{"liked_by": user\["user_id"\]\}, "\$inc": \{"likes": -1\}\}\s*\)', 
"""post = _get_one("community_posts", "post_id", post_id)
        if post and user["user_id"] in post.get("liked_by", []):
            new_likes = post.get("likes", 1) - 1
            new_liked_by = [u for u in post.get("liked_by", []) if u != user["user_id"]]
            db.table("community_posts").update({"liked_by": new_liked_by, "likes": new_likes}).eq("post_id", post_id).execute()""", text)

text = re.sub(r'await db\.community_posts\.update_one\(\s*\{"post_id": post_id\},\s*\{"\$push": \{"liked_by": user\["user_id"\]\}, "\$inc": \{"likes": 1\}\}\s*\)', 
"""post = _get_one("community_posts", "post_id", post_id)
        if post and user["user_id"] not in post.get("liked_by", []):
            new_likes = post.get("likes", 0) + 1
            new_liked_by = post.get("liked_by", []) + [user["user_id"]]
            db.table("community_posts").update({"liked_by": new_liked_by, "likes": new_likes}).eq("post_id", post_id).execute()""", text)

text = re.sub(r'await db\.community_posts\.update_one\(\s*\{"post_id": post_id\},\s*\{"\$push": \{"comments": comment\}\}\s*\)', 
"""post = _get_one("community_posts", "post_id", post_id)
    if post:
        new_comments = post.get("comments", []) + [comment]
        db.table("community_posts").update({"comments": new_comments}).eq("post_id", post_id).execute()""", text)


# Replace delete_many
text = re.sub(r'await db\.([a-zA-Z_]+)\.delete_many\(\{"([a-zA-Z_]+)": ([^}]+)\}\)', r'db.table("\1").delete().eq("\2", \3).execute()', text)

# Replace find().sort().limit().to_list()
text = re.sub(r'await db\.chat_messages\.find\(\s*\{"user_id": user_id\}, \{"_id": 0\}\s*\)\.sort\("created_at", -1\)\.limit\(10\)\.to_list\(10\)',
r'db.table("chat_messages").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(10).execute().data', text)

text = re.sub(r'await db\.chat_messages\.find\(\s*\{"user_id": user\["user_id"\]\}, \{"_id": 0\}\s*\)\.sort\("created_at", 1\)\.limit\(50\)\.to_list\(50\)',
r'db.table("chat_messages").select("*").eq("user_id", user["user_id"]).order("created_at", desc=False).limit(50).execute().data', text)

text = re.sub(r'await db\.disease_scans\.find\(\s*\{"user_id": user\["user_id"\]\}, \{"_id": 0\}\s*\)\.sort\("created_at", -1\)\.limit\(20\)\.to_list\(20\)',
r'db.table("disease_scans").select("*").eq("user_id", user["user_id"]).order("created_at", desc=True).limit(20).execute().data', text)

text = re.sub(r'await db\.community_posts\.find\(\{\}, \{"_id": 0\}\)\.sort\("created_at", -1\)\.skip\(skip\)\.limit\(limit\)\.to_list\(limit\)',
r'db.table("community_posts").select("*").order("created_at", desc=True).range(skip, skip + limit - 1).execute().data', text)


# Remove client.close()
text = re.sub(r'@app\.on_event\("shutdown"\)\s*async def shutdown_db_client\(\):\s*client\.close\(\)', r'', text)

with open("server2.py", "w") as f:
    f.write(text)

print("Converted setup!")
