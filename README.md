# MemoAgent — Simple overview 

[![Watch the demo](https://img.youtube.com/vi/e4BuAgaFtPM/0.jpg)](https://youtu.be/e4BuAgaFtPM)  
Demo: https://youtu.be/e4BuAgaFtPM

---

## Project Overview
MemoAgent is an intelligent, conversational video assistant. Upload any video and ask for edits, highlights, summaries, clips, or audio fixes in plain language — no editing skills required. It saves user preferences so future jobs follow a consistent style. MemoAgent helps creators, students, marketers, and teams save time and produce polished short videos from long footage.

---

## Team Introduction
I am a student from Bangladesh.  
Role: student

---

## Key Features & Tech Stack
### Key features
- Natural-language requests for video edits (e.g., "Make a 30s highlight reel").
- Summaries & scene search (find where topics/words appear).
- Clip extraction for social formats.
- Audio clean-up: noise removal and voice boost.
- Memory-aware personalization (remember preferred styles).

### Tech stack
- memories.ai API — stores and recalls user preferences, saved styles, and past jobs.  
- runwere.ai API — runs video processing tasks (trimming, filters, assembly).  
- Web UI (uploader + request box) — user-facing interface for uploads and plain-language requests.

---

## Sponsor Tools Used (and how they were integrated)
- runwere.ai — Integrated as the primary video processing engine. After MemoAgent parses a user request into processing steps, it calls runwere.ai APIs to extract clips, apply filters/transitions, and assemble the final video.
- memories.ai — Used for persistent memory: saving user style presets and retrieving them to personalize subsequent jobs.

---

## Challenges & Learnings
### Challenges
- Converting open-ended natural-language requests into reliable processing steps.
- Handling very large video files while keeping processing time reasonable.
- Ensuring privacy and safe handling of uploaded content.

### Learnings
- Specific, well-structured prompts (time ranges, mood, style) greatly improve results.
- Storing style presets yields more consistent outputs across multiple videos.
- Leveraging specialized APIs (runwere, memories) speeds development and offloads heavy processing.

---

## Future Improvements / Next Steps
- Add preset styles (social, cinematic, podcast) users can select.
- Improve upload and processing speed with progress indicators for large files.
- Add stronger privacy controls and one-click deletion of uploaded content.
- Multi-language support for prompts and transcripts.
- In-app tutorial and a copy/paste prompt cheat-sheet for non-technical users.

---

## How to use (non-technical)
1. Open MemoAgent (web app).  
2. Upload your video file.  
3. Type a request in plain language (e.g., "Create a 15s social cut with captions and upbeat music").  
4. Submit and wait — processing time varies.  


---

## Demo
Click the thumbnail at the top to watch the short demonstration: https://youtu.be/e4BuAgaFtPM



---

If you want the headings renamed or re-ordered (for example to add a separate FAQ H2 or a "Contact" H2), tell me which headings to change and I will update the file for copy/paste.  
