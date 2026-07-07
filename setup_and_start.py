import os
import sys
import subprocess
import urllib.request
import platform
import time
import shutil
import re

def print_step(msg):
    print(f"\n{'='*50}")
    print(f" {msg}")
    print(f"{'='*50}\n")

def replace_hardcoded_name():
    print_step("Personalize Your Bot")
    print("The bot currently refers to its creator as 'Father Cyber'.")
    new_name = input("What is YOUR name? (e.g. John, Alex) [Press Enter to keep default]: ").strip()
    
    if not new_name:
        print("No name provided. Keeping default.")
        return
        
    print(f"Replacing 'Cyber' with '{new_name}' across the codebase... please wait.")
    
    extensions = ('.js', '.py', '.json')
    exclude_dirs = ('node_modules', '.git', 'logs', 'global-messages', '.wwebjs_auth', '.wwebjs_cache', 'scratch', 'venv', '.venv')
    
    count = 0
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for file in files:
            if file.endswith(extensions):
                filepath = os.path.join(root, file)
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    if 'Cyber' in content:
                        content = content.replace('Father Cyber', f'Father {new_name}')
                        content = content.replace('Daddy Cyber', f'Daddy {new_name}')
                        content = content.replace("Cyber's", f"{new_name}'s")
                        content = re.sub(r'\bCyber\b', new_name, content)
                        
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(content)
                        count += 1
                except Exception:
                    pass
    
    print(f"✅ Successfully updated your name in {count} files!\n")

def run_cmd(cmd, check=True):
    try:
        subprocess.run(cmd, check=check, shell=True)
        return True
    except subprocess.CalledProcessError:
        return False

def ensure_env_file():
    print_step("Configuring Environment Variables (.env)")
    if not os.path.exists(".env"):
        if os.path.exists(".env.example"):
            print("⚙️  Creating .env file from .env.example...")
            shutil.copyfile(".env.example", ".env")
        else:
            print("⚙️  Creating a blank .env file...")
            with open(".env", "w") as f:
                f.write("NODE_ENV=production\n")
    
    # Auto-detect IP and set RECEIVER_URL
    try:
        print("🔍 Detecting public IP address...")
        req = urllib.request.Request('https://api.ipify.org')
        with urllib.request.urlopen(req, timeout=5) as response:
            public_ip = response.read().decode('utf8').strip()
        print(f"✅ Detected Public IP: {public_ip}")
    except Exception as e:
        print(f"⚠️ Could not detect public IP: {e}")
        public_ip = "127.0.0.1"

    env_lines = []
    with open(".env", "r") as f:
        env_lines = f.readlines()
        
    has_receiver = any("RECEIVER_URL" in line for line in env_lines)
    has_ip = any("SLAVE_DEVICE_IP" in line for line in env_lines)
    
    with open(".env", "a") as f:
        if not has_receiver:
            print("🔗 Setting RECEIVER_URL to connect to Linux Host (celestia.cyber-winner.site)")
            f.write("\nRECEIVER_URL=http://celestia.cyber-winner.site:3200\n")
        if not has_ip:
            f.write(f"SLAVE_DEVICE_IP={public_ip}\n")
            
    print("✅ Environment configuration complete.")

def setup_pm2():
    print_step("Installing PM2 Process Manager globally...")
    # Using npm.cmd on Windows to prevent issues
    npm_cmd = "npm.cmd" if platform.system() == "Windows" else "npm"
    run_cmd(f"{npm_cmd} install -g pm2")
    
    # Generate Windows friendly ecosystem
    if platform.system() == "Windows":
        print("⚙️  Creating Windows-compatible PM2 configuration...")
        try:
            with open("ecosystem.config.js", "r") as f:
                config_data = f.read()
            # Windows uses NUL instead of /dev/null
            config_data = config_data.replace("'/dev/null'", "'NUL'")
            with open("ecosystem.windows.js", "w") as f:
                f.write(config_data)
        except Exception as e:
            print(f"⚠️ Warning modifying ecosystem file: {e}")

def main():
    print_step("Welcome to Celestia Bot Native Setup!")
    
    replace_hardcoded_name()
    ensure_env_file()
    setup_pm2()
    
    print_step("🚀 Starting Bot Services with PM2...")
    pm2_cmd = "pm2.cmd" if platform.system() == "Windows" else "pm2"
    ecosystem_file = "ecosystem.windows.js" if platform.system() == "Windows" else "ecosystem.config.js"
    
    success = run_cmd(f"{pm2_cmd} start {ecosystem_file}")
    
    if success:
        print_step("🎉 Bot successfully started in the background via PM2!")
        print("Opening logs so you can scan the WhatsApp QR Code.")
        print("Press Ctrl+C to exit the log view (the bot will KEEP RUNNING).")
        time.sleep(3)
        try:
            run_cmd(f"{pm2_cmd} logs celestia-wa-bot", check=False)
        except KeyboardInterrupt:
            print("\n\n✅ Exited log view. The bot is STILL RUNNING in the background.")
            print(f"To view logs later, run: {pm2_cmd} logs")
            print(f"To stop the bot, run: {pm2_cmd} stop all")
    else:
        print_step("❌ Failed to start the bot via PM2. Please check errors.")

if __name__ == "__main__":
    main()

