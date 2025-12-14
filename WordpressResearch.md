# WordPress Integration Plan

## Objective
Embed FinanceBuddy quiz into dazia.ca WordPress site for IFIC, CSC, and LLQP certifications.

## Recommended Approach: Iframe Embedding

### Why Iframe?
- ✅ Simple implementation (5-10 minutes)
- ✅ Works with all GoDaddy hosting plans
- ✅ No WordPress coding required
- ✅ Clean separation between quiz app and WordPress site

### Implementation

**WordPress Page Code:**
```html
<div class="quiz-container">
  <iframe 
    src="https://your-deployed-quiz-url.com?course=IFIC" 
    width="100%" 
    height="900px"
    frameborder="0"
    style="border: none; border-radius: 8px;"
  ></iframe>
</div>

<style>
  .quiz-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
  }
  
  @media (max-width: 768px) {
    iframe { height: 1200px; }
  }
</style>
```

### Alternative Considered: WordPress Plugin
- More complex (8-10 hours extra development)
- Requires WordPress/PHP knowledge
- May have GoDaddy restrictions
- **Decision:** Not needed for MVP

## GoDaddy Compatibility
- ✅ Iframe embedding supported on all plans
- ✅ Custom HTML blocks available
- ✅ No special permissions needed

## Deployment Strategy (Week 8)

1. **Backend Deployment**
   - Platform: Render.com or Railway.app (free tier)
   - API endpoints for quiz generation and chatbot

2. **Frontend Deployment**
   - Platform: Netlify or Vercel (free tier)
   - React quiz interface

3. **WordPress Integration**
   - Create pages: `/ific-quiz`, `/csc-quiz`, `/llqp-quiz`
   - Add iframe code to each page
   - Test on mobile and desktop

## Mobile Responsiveness
Will use CSS media queries to adjust iframe height for mobile devices.

## Timeline
- Week 8, Day 1-2: Deploy backend and frontend
- Week 8, Day 3: WordPress page creation
- Week 8, Day 4: Mobile testing
- Week 8, Day 5: Final adjustments

---

**Created:** December 10, 2024  
**Status:** Research Complete ✅
