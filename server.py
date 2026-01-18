from flask import Flask, request, jsonify, send_file, render_template
from flask_cors import CORS
import subprocess
import os
import json
import threading
import time
from pathlib import Path
import yt_dlp

app = Flask(__name__)
CORS(app)

# Configuration
DOWNLOAD_FOLDER = "downloads"
os.makedirs(DOWNLOAD_FOLDER, exist_ok=True)

# Active downloads tracking
active_downloads = {}

class YouTubeDownloader:
    def __init__(self):
        self.ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'progress_hooks': [self.progress_hook],
        }
    
    def progress_hook(self, d):
        """Progress hook for yt-dlp"""
        if d['status'] == 'downloading':
            # Update progress for this download
            download_id = d.get('info_dict', {}).get('id', '')
            if download_id in active_downloads:
                active_downloads[download_id]['progress'] = d.get('_percent_str', '0%')
                active_downloads[download_id]['speed'] = d.get('_speed_str', 'N/A')
                active_downloads[download_id]['eta'] = d.get('_eta_str', 'N/A')
    
    def get_video_info(self, url):
        """Get video information without downloading"""
        with yt_dlp.YoutubeDL({'quiet': True}) as ydl:
            try:
                info = ydl.extract_info(url, download=False)
                return {
                    'success': True,
                    'title': info.get('title', 'Unknown'),
                    'duration': info.get('duration', 0),
                    'uploader': info.get('uploader', 'Unknown'),
                    'view_count': info.get('view_count', 0),
                    'thumbnail': info.get('thumbnail', ''),
                    'formats': self.get_available_formats(info)
                }
            except Exception as e:
                return {'success': False, 'error': str(e)}
    
    def get_available_formats(self, info):
        """Extract available formats from video info"""
        formats = []
        if 'formats' in info:
            for f in info['formats']:
                if f.get('vcodec') != 'none' or f.get('acodec') != 'none':
                    formats.append({
                        'format_id': f.get('format_id', ''),
                        'ext': f.get('ext', ''),
                        'resolution': f.get('resolution', ''),
                        'filesize': f.get('filesize', 0),
                        'note': f.get('format_note', '')
                    })
        return formats
    
    def download_video(self, url, format_type='mp4', quality='720', download_id=None):
        """Download video with specified format and quality"""
        try:
            # Set output template
            output_template = os.path.join(DOWNLOAD_FOLDER, '%(title)s.%(ext)s')
            
            # Configure options based on format
            ydl_opts = self.ydl_opts.copy()
            ydl_opts['outtmpl'] = output_template
            
            if format_type == 'mp3':
                ydl_opts.update({
                    'format': 'bestaudio/best',
                    'postprocessors': [{
                        'key': 'FFmpegExtractAudio',
                        'preferredcodec': 'mp3',
                        'preferredquality': quality,
                    }],
                })
            elif format_type == 'mp4':
                if quality == 'best':
                    ydl_opts['format'] = 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
                else:
                    ydl_opts['format'] = f'bestvideo[height<={quality}][ext=mp4]+bestaudio[ext=m4a]/best[height<={quality}][ext=mp4]/best'
                ydl_opts['merge_output_format'] = 'mp4'
            else:
                ydl_opts['format'] = 'best'
            
            # Start download
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                filename = ydl.prepare_filename(info)
                
                if format_type == 'mp3':
                    filename = filename.replace('.webm', '.mp3').replace('.m4a', '.mp3')
                
                return {
                    'success': True,
                    'filename': os.path.basename(filename),
                    'title': info.get('title', ''),
                    'duration': info.get('duration', 0),
                    'filesize': os.path.getsize(filename) if os.path.exists(filename) else 0
                }
        
        except Exception as e:
            return {'success': False, 'error': str(e)}
        
        finally:
            if download_id in active_downloads:
                del active_downloads[download_id]

downloader = YouTubeDownloader()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/video_info', methods=['POST'])
def video_info():
    data = request.json
    url = data.get('url', '')
    
    if not url:
        return jsonify({'success': False, 'error': 'No URL provided'})
    
    info = downloader.get_video_info(url)
    return jsonify(info)

@app.route('/api/download', methods=['POST'])
def download():
    data = request.json
    url = data.get('url', '')
    format_type = data.get('format', 'mp4')
    quality = data.get('quality', '720')
    
    if not url:
        return jsonify({'success': False, 'error': 'No URL provided'})
    
    # Generate unique ID for this download
    download_id = f"dl_{int(time.time())}"
    active_downloads[download_id] = {
        'progress': '0%',
        'status': 'downloading',
        'url': url
    }
    
    # Start download in background thread
    def download_thread():
        result = downloader.download_video(url, format_type, quality, download_id)
        active_downloads[download_id]['result'] = result
    
    thread = threading.Thread(target=download_thread)
    thread.start()
    
    return jsonify({
        'success': True,
        'download_id': download_id,
        'message': 'Download started'
    })

@app.route('/api/progress/<download_id>', methods=['GET'])
def get_progress(download_id):
    if download_id not in active_downloads:
        return jsonify({'success': False, 'error': 'Download not found'})
    
    download_info = active_downloads[download_id]
    if 'result' in download_info:
        return jsonify({
            'success': True,
            'complete': True,
            'result': download_info['result']
        })
    
    return jsonify({
        'success': True,
        'complete': False,
        'progress': download_info.get('progress', '0%'),
        'speed': download_info.get('speed', 'N/A'),
        'eta': download_info.get('eta', 'N/A')
    })

@app.route('/api/download_file/<filename>', methods=['GET'])
def download_file(filename):
    file_path = os.path.join(DOWNLOAD_FOLDER, filename)
    
    if not os.path.exists(file_path):
        return jsonify({'success': False, 'error': 'File not found'})
    
    return send_file(file_path, as_attachment=True)

@app.route('/api/history', methods=['GET'])
def get_history():
    # This would read from a database in production
    return jsonify({'history': []})

@app.route('/api/cancel/<download_id>', methods=['POST'])
def cancel_download(download_id):
    if download_id in active_downloads:
        # Note: yt-dlp doesn't have a built-in cancel method
        # This would need more complex implementation
        del active_downloads[download_id]
        return jsonify({'success': True, 'message': 'Download cancelled'})
    
    return jsonify({'success': False, 'error': 'Download not found'})

if __name__ == '__main__':
    print("FRENESIS YouTube Downloader Server")
    print("===================================")
    print("Starting server on http://localhost:5000")
    print("Make sure yt-dlp is installed: pip install yt-dlp")
    print("Make sure FFmpeg is installed for format conversion")
    print("\nOpen your browser and go to: http://localhost:5000")
    app.run(debug=True, port=5000)
