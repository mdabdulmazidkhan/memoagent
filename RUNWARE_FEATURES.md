# Runware AI Chatbot - Complete Feature Guide

## 🎨 **All Available Features**

Your chatbot now supports **10 major Runware AI capabilities**:

### **1. Text-to-Image Generation** 🖼️
Generate images from text descriptions.

**Commands:**
- "make an image of a sunset"
- "create a picture of a cat wearing sunglasses"
- "generate a photo of mountains at night"

**Advanced:**
- "make an image of a dragon using SDXL"
- "create an image of a castle using FLUX"

**Supported Models:**
- `FLUX` (default) - Fast & high quality
- `SDXL` - Stable Diffusion XL
- `SD3` - Stable Diffusion 3

---

### **2. Image-to-Image Transformation** 🔄
Transform existing images based on prompts.

**Commands:**
- "transform this image into cyberpunk style"
- "modify this photo to look like watercolor painting"
- "change this image to nighttime"

---

### **3. Text-to-Video Generation** 🎬
Generate videos from text descriptions.

**Commands:**
- "create a video of waves crashing on beach"
- "make a video of a bird flying through clouds"
- "generate a video of northern lights"

**Model:** Kling AI (5-second videos)

---

### **4. Image-to-Video Animation** 🎞️
Animate static images into videos.

**Commands:**
- "animate this image"
- "create a video from this image"
- "make this picture move"

---

### **5. Background Removal** ✂️
Remove backgrounds from images.

**Commands:**
- "remove background from this image"
- "delete the background"

---

### **6. Image Upscaling** 📈
Enhance image resolution.

**Commands:**
- "upscale this image"
- "enlarge this image 4x"
- "enhance image quality 2x"

**Factors:** 2x, 3x, or 4x

---

### **7. Image Inpainting** 🎨
Edit specific parts of images using masks.

**Commands:**
- "inpaint this image with new sky"
- "replace part of this image"
- "edit part of this photo"

**Requires:** Original image + mask image

---

### **8. Image Captioning** 💬
Generate descriptions for images.

**Commands:**
- "caption this image"
- "describe this picture"
- "what's in this photo"

---

### **9. Prompt Enhancement** ✨
Improve and enhance your prompts.

**Commands:**
- "enhance prompt: a beautiful landscape"
- "improve prompt: cat in space"

---

### **10. ControlNet Preprocessing** 🎯
Extract edges, depth, pose from images.

**Commands:**
- "detect edges in this image"
- "create depth map"
- "pose detection from this image"

**Types:** canny (edges), depth, pose, mlsd (lines)

---

## 🎛️ **Advanced Parameters**

All text-to-image commands support:
- **Width/Height:** 128-2048 pixels (divisible by 64)
- **Steps:** 1-100 iterations
- **CFG Scale:** 0-50 (guidance strength)
- **Seed:** For reproducible results
- **Number of Results:** 1-20 images

---

## 📊 **Model Options**

### **Image Models:**
- `runware:100@1` - FLUX Schnell (default, fast)
- `civitai:4201@130090` - SDXL
- `civitai:139562@297320` - SD3

### **Video Models:**
- `runware:501@1` - Kling AI (default)

---

## 💡 **Usage Examples**

### **Simple Image:**
```
make an image of a sunset
```

### **Advanced Image:**
```
create a detailed fantasy castle on a cliff, 1024x768, using SDXL, 30 steps
```

### **Video:**
```
create a video of a waterfall in the forest, 5 seconds
```

### **Image Transformation:**
```
transform this image into anime style with 0.7 strength
```

### **Multiple Results:**
```
generate 4 images of a futuristic city
```

---

## ⚙️ **Setup Required**

Make sure you've set your Runware API key in Settings:
- **Secret name:** `RunwareApiKey`
- **Secret value:** `sXrFO6CYqrY1QI44Uga865d8dNrvi3fm`

---

## 🚀 **What's New**

✅ 10 complete Runware features
✅ Text-to-video generation  
✅ Image-to-video animation  
✅ Advanced image editing (inpainting, i2i)  
✅ Image analysis (captioning, controlnet)  
✅ Prompt enhancement  
✅ Model selection (FLUX, SDXL, SD3)  
✅ Custom parameters (size, steps, guidance)  
✅ Smart command detection  

---

**Your chatbot is now a complete AI creative studio!** 🎨✨