import os
import sqlite3

def add_audio_url_column(db_path):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    # 检查是否已存在 audio_url 字段
    c.execute("PRAGMA table_info(messages)")
    columns = [row[1] for row in c.fetchall()]
    if 'audio_url' not in columns:
        print(f"升级 {db_path} ...")
        c.execute("ALTER TABLE messages ADD COLUMN audio_url VARCHAR(256)")
        conn.commit()
        print(f"已添加 audio_url 字段")
    else:
        print(f"{db_path} 已有 audio_url 字段，无需升级")
    conn.close()

def upgrade_all():
    db_dir = 'instance'
    if not os.path.exists(db_dir):
        print("未找到 instance 目录")
        return
    for fname in os.listdir(db_dir):
        if fname.endswith('.db'):
            db_path = os.path.join(db_dir, fname)
            add_audio_url_column(db_path)

if __name__ == '__main__':
    upgrade_all() 