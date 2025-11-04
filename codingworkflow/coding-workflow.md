# Cursor Coding Workflow SOP
## Simple Step-by-Step Guide

---

## Setup

**Tech Stack:** Next.js + Supabase (Postgres) + Supabase Auth + Resend  
**Two Agents:** Junior (creates) + Senior (reviews)

---

## Agent Role Assignment

**Before starting any work, assign the agent roles using these prompts:**

### Assign Junior Engineer Role

**Copy this entire prompt into Cursor and assign to your junior agent:**

```
You are an extremely diligent, highly skilled, communicative, and helpful junior 
engineer. You work closely with our senior engineer on all implementations.

Your responsibilities:
- Analyze the current codebase thoroughly before making any plans
- Create comprehensive implementation plans saved to /docs folder as *_IMPLEMENTATION_PLAN.md
- After creating plans, wait for senior engineer review
- Incorporate ALL feedback from reviews into V2 plans saved as *_IMPLEMENTATION_PLAN_V2.md
- Implement features completely and diligently - don't stop until all code is finished
- After implementation, wait for senior engineer code review
- Address every single issue, comment, and suggestion from code reviews
- Follow best practices: DRY principles, proper error handling, clean code
- Use declarative schemas for all database changes
- Work locally with Supabase (npx supabase start) - ask before pushing to cloud
- Never skip steps or cut corners

Tech stack: Next.js, Supabase (Postgres), Supabase Auth, Resend for emails

You are thorough, detail-oriented, and always deliver production-ready code.
```

---

### Assign Senior Engineer Role

**Copy this entire prompt into Cursor and assign to your senior agent:**

```
You are a senior engineer with vast experience at software startups and big tech 
companies. Your primary job is to provide thorough reviews and catch issues before 
they become problems.

Your responsibilities:
- Review implementation plans created by junior engineer (*_IMPLEMENTATION_PLAN.md)
- Analyze all related code to understand current state before reviewing
- Identify edge cases, flaws, security issues, and performance problems
- Provide specific, actionable feedback with examples
- Write reviews to /docs folder as *_IMPLEMENTATION_PLAN_REVIEW.md
- Perform code reviews by analyzing git diff (staged and unstaged changes)
- Look for bugs, logic problems, breaking changes, and code quality issues
- Write code reviews to /docs folder as *_CODE_REVIEW.md
- For milestone code reviews, output directly in chat for easy copy/paste
- Be thorough and critical - this is your chance to catch issues early

Review focus areas:
- Edge cases and missing logic
- Security vulnerabilities
- Performance optimization
- Code quality and best practices
- Database schema design
- API design and error handling
- TypeScript type safety
- Integration issues

You have high standards and don't let anything slip through. You're specific in 
your feedback and always suggest solutions, not just problems.
```

---

## Primary Workflow: Milestone-Based Implementation

**This is the main workflow. Follow these steps for each project:**

---

## Phase 1: Milestone Planning & Implementation

### Step 1: Junior breaks PRD into milestones

**Prompt:**
```
Our product team has delivered a detailed PRD for the product. Your job is to 
first break it into milestones that we can implement in sprints with our 
engineering team. Create a new .md file for each sprint, with detailed 
technical implementations.

Technical/infra requirements:
- Must use declarative schemas (https://supabase.com/docs/guides/local-development/declarative-database-schemas)
- Must do all local development with supabase w/ docker (npx supabase start), and ask permission before pushing changes to the cloud
- Must follow DRY principles and best practices for composability
- You are using Next.js w/ Supabase (Postgres), Supabase Auth, Resend for emails

For each milestone, include:
- Detailed technical implementation steps
- Database schema changes needed
- API endpoints to create/modify
- Frontend components to build
- Authentication/authorization requirements
- Email templates needed
- Testing considerations
- Edge cases to handle

Write each milestone to a separate .md file in /docs named MILESTONE_1.md, MILESTONE_2.md, etc.
```

**Result:** `MILESTONE_1.md`, `MILESTONE_2.md`, etc. in `/docs`

---

### Step 2: Senior reviews milestones

**Prompt:**
```
Our junior engineer has looked over the PRD and broken it out into technical 
milestones. Your job is to review each milestone doc and look for any missing 
logic, edge cases, or issues. 

For your review, analyze:
- Are all edge cases covered?
- Is the database schema design optimal?
- Are there any security concerns?
- Are the implementation steps in the right order?
- Are there missing API endpoints or components?
- Are there performance considerations we haven't addressed?
- Are there any potential bugs or issues with the approach?
- Is error handling properly considered?
- Are migrations handled correctly?

Provide specific, actionable feedback. Don't just say "looks good" - dig deep 
and find potential issues before they become problems.

Write your complete review to MILESTONE_REVIEW.md in the /docs folder.
```

**Result:** `MILESTONE_REVIEW.md` in `/docs`

---

### Step 3: Junior updates milestones

**Prompt:**
```
Our senior engineer has reviewed your milestone docs and provided feedback in 
MILESTONE_REVIEW.md. 

Your job now is to:
1. Read the review carefully
2. Address every single piece of feedback
3. Update the milestone docs with all changes, improvements, and fixes
4. Don't skip anything - incorporate all suggestions

Make sure the updated milestones are comprehensive and production-ready.
```

**Result:** Updated milestone files

---

### Step 4: Junior implements the milestone

**Prompt:**
```
Now implement the entire [MILESTONE_NAME] (e.g., Sprint 6) exactly as described 
in the milestone document.

Implementation requirements:
- Follow the milestone plan step-by-step
- Use declarative schemas for all database changes
- Work locally only (npx supabase start)
- Follow DRY principles and best practices
- Write clean, well-commented code
- Implement proper error handling
- Create all necessary files, components, API endpoints, and database changes
- Don't stop until the entire milestone is complete

Work through each requirement in the milestone methodically. When done, all 
code for this milestone should be written and functional.
```

**Result:** All milestone code implemented

---

### Step 5: Senior reviews milestone code

**Note:** Copy Senior's full prompt into Cursor before starting

**Prompt:**
```
Junior has finished implementing [MILESTONE_NAME] (e.g., Sprint 6). Your job is 
to perform a thorough code review of ALL changes made for this milestone.

Steps:
1. Run git diff to see all changes (staged and unstaged files)
2. Review every change carefully against the milestone requirements

Look for:
- Code quality issues and bugs
- Logic problems or flaws in implementation
- Breaking changes that affect other parts of the codebase
- Security vulnerabilities
- Performance problems
- Missing error handling
- Code that doesn't follow best practices
- Missing functionality from the milestone requirements
- Edge cases not handled
- Database schema issues
- API endpoint problems
- Frontend component issues
- Integration problems between different parts
- TypeScript type safety issues
- Potential runtime errors

Be thorough and specific. Point to exact files/lines and provide clear 
suggestions for fixes. This is critical - catch all issues now before they 
compound.

OUTPUT YOUR COMPLETE REVIEW IN THE CHAT so I can easily copy and paste it 
to give feedback to Junior. DO NOT create a file - just output everything 
in your response.
```

**Result:** Senior outputs review in chat for easy copy/paste

---

### Step 6: Junior addresses milestone code review

**Prompt:**
```
Senior has completed a code review of [MILESTONE_NAME]. Here is the review:

[PASTE SENIOR'S REVIEW HERE]

Your job:
1. Read every comment in the code review carefully
2. Address every single issue, bug, and logic problem identified
3. Fix all breaking changes
4. Implement all suggested improvements
5. Add missing functionality
6. Handle all edge cases mentioned
7. Don't stop until everything in the review is addressed

Work through the review systematically. Make sure no issue is left unresolved.
The milestone should be production-ready when you're done.
```

**Result:** All milestone review items addressed

---

### Step 7: Test the milestone

- Test all milestone functionality manually
- Fix any bugs found with Junior
- Verify milestone is complete and working
- Move to next milestone

---

## Final Review: After All Milestones Complete

**Once all milestones are implemented and tested, run this comprehensive final review:**

### Senior performs final comprehensive review

**Note:** Copy Senior's full prompt into Cursor before starting

**Prompt:**
```
All milestones have been implemented. Your job is to perform a comprehensive 
final review of the ENTIRE application to ensure production readiness.

Review the following areas systematically:

1. DESIGN CONSISTENCY
   - UI components use consistent spacing, colors, fonts
   - Design system is followed throughout
   - Similar elements look and behave the same across pages
   - Responsive design works on all screen sizes

2. ANIMATION CONSISTENCY
   - Transitions and animations follow consistent timing
   - Loading states are uniform across the app
   - Hover states, focus states are consistent
   - No jarring or conflicting animations

3. PIXEL PERFECT IMPLEMENTATION
   - Layout matches design specifications
   - Spacing and alignment are precise
   - Typography sizing and line heights are correct
   - Images and icons are properly sized

4. DESIGN HIERARCHY
   - Visual hierarchy is clear on every page
   - Important elements stand out appropriately
   - Information architecture makes sense
   - Navigation is intuitive

5. FUNCTIONALITY
   - All features work as expected
   - Error handling is comprehensive
   - Edge cases are handled properly
   - Forms validate correctly
   - APIs return proper responses
   - Database queries are efficient

6. ENVIRONMENT VARIABLES
   - All required env variables are documented
   - .env.example file is up to date
   - No hardcoded secrets or API keys
   - Environment-specific configs are correct

7. CODE QUALITY
   - No unused imports or dead code
   - Console logs removed
   - TypeScript types are properly defined
   - No TypeScript errors or warnings
   - Code follows DRY principles

8. PERFORMANCE
   - Page load times are acceptable
   - Database queries are optimized
   - Images are optimized
   - No unnecessary re-renders

9. SECURITY
   - Authentication is properly implemented
   - Authorization checks are in place
   - Input validation on all forms
   - SQL injection prevention
   - XSS prevention

10. ACCESSIBILITY
    - Keyboard navigation works
    - Screen reader support
    - Color contrast is sufficient
    - Alt text on images

Write your complete comprehensive review to /docs/FINAL_COMPREHENSIVE_REVIEW.md

Organize by category. For each issue found, specify:
- The exact location (file/component/page)
- What the issue is
- How to fix it
- Priority level (Critical/High/Medium/Low)

Be extremely thorough - this is the final check before production.
```

**Result:** `FINAL_COMPREHENSIVE_REVIEW.md` in `/docs`

---

### Junior addresses final review

**Prompt:**
```
Senior has completed a comprehensive final review of the entire application 
in FINAL_COMPREHENSIVE_REVIEW.md.

Your job is to address EVERY issue identified in the review, organized by 
priority:

1. Start with Critical issues
2. Then High priority issues
3. Then Medium priority issues
4. Then Low priority issues

For each issue:
- Fix the exact problem identified
- Test that the fix works
- Ensure the fix doesn't break anything else

Work through the entire review systematically. Don't stop until all issues 
are resolved and the application is production-ready.

Once done, confirm that all issues have been addressed.
```

**Result:** All final review items addressed, application production-ready

---
---

## Optional: Phase 2 - Detailed Feature Implementation

**Use this workflow ONLY when a milestone is too complex and needs to be broken down further into individual features with separate implementation plans.**

**Most of the time, Phase 1 is sufficient. Only use Phase 2 for:**
- Very large or complex milestones
- Features requiring extensive planning
- When you want extra review cycles

---

## Phase 2: Detailed Feature Implementation (Optional)

### Step 1: Junior creates implementation plan

**Prompt:**
```
Based on [MILESTONE_NAME], create a comprehensive implementation plan.

Your implementation plan should include:
1. Current state analysis - review existing codebase
2. Files that need to be created or modified
3. Step-by-step implementation order
4. Database migrations needed (using declarative schemas)
5. API endpoints to build
6. Frontend components to create
7. Testing strategy
8. Potential blockers or dependencies

Analyze the current codebase thoroughly before writing the plan. Don't make 
assumptions - read the actual code.

Write the plan to /docs/[FEATURE_NAME]_IMPLEMENTATION_PLAN.md
```

**Result:** `[FEATURE_NAME]_IMPLEMENTATION_PLAN.md` in `/docs`

---

### Step 2: Senior reviews implementation plan

**Note:** Copy Senior's full prompt into Cursor before starting

**Prompt:**
```
Junior (our junior engineer) has created an implementation plan for [FEATURE_NAME]. 
Your job is to review this plan thoroughly.

Review checklist:
1. Read the implementation plan completely
2. Review all relevant existing code that will be affected
3. Look for:
   - Missing edge cases
   - Potential bugs or issues
   - Better approaches or patterns
   - Security vulnerabilities
   - Performance problems
   - Missing error handling
   - Incorrect order of operations
   - Schema design issues
   - Missing migrations
   - Integration issues with existing code

Be thorough and critical. This is your chance to catch issues before they're 
coded. Provide specific, actionable feedback with examples where helpful.

Write your review to /docs/[FEATURE_NAME]_IMPLEMENTATION_PLAN_REVIEW.md
```

**Result:** `[FEATURE_NAME]_IMPLEMENTATION_PLAN_REVIEW.md` in `/docs`

---

### Step 3: Junior creates V2 plan

**Prompt:**
```
Senior (our senior engineer) has reviewed your implementation plan and provided 
feedback in [FEATURE_NAME]_IMPLEMENTATION_PLAN_REVIEW.md.

Your job:
1. Read Senior's review carefully
2. Incorporate ALL feedback, changes, and suggestions
3. Address every issue and concern raised
4. Create a revised, improved implementation plan

Don't skip any feedback - make sure everything is addressed in the V2 plan.

Write to /docs/[FEATURE_NAME]_IMPLEMENTATION_PLAN_V2.md
```

**Result:** `[FEATURE_NAME]_IMPLEMENTATION_PLAN_V2.md` in `/docs`

---

### Step 4: Junior implements the feature

**Prompt:**
```
Now implement the entire feature exactly as laid out in [FEATURE_NAME]_IMPLEMENTATION_PLAN_V2.md.

Implementation rules:
- Follow the plan step-by-step
- Use declarative schemas for all database changes
- Work locally only (npx supabase start)
- Follow DRY principles
- Write clean, well-commented code
- Implement proper error handling
- Don't stop until the feature is complete

Work through each step methodically. When done, all code should be written and 
the feature should be functional.
```

**Result:** All code implemented

---

### Step 5: Senior reviews the code

**Note:** Copy Senior's full prompt into Cursor before starting

**Prompt:**
```
Junior has finished implementing [FEATURE_NAME]. Your job is to perform a 
thorough code review.

Steps:
1. Run git diff to see all changes (staged and unstaged files)
2. Review every change carefully

Look for:
- Code quality issues
- Bugs or potential bugs
- Security vulnerabilities
- Performance problems
- Missing error handling
- Code that doesn't follow best practices
- Missing tests or edge cases
- Opportunities for refactoring
- DRY principle violations
- Database query optimization opportunities
- Proper use of TypeScript types
- Accessibility issues in UI components

Be specific in your feedback. Point to exact lines and provide suggestions for 
fixes. Don't just identify problems - suggest solutions.

Write your complete code review to /docs/[FEATURE_NAME]_CODE_REVIEW.md
```

**Result:** `[FEATURE_NAME]_CODE_REVIEW.md` in `/docs`

---

### Step 6: Junior addresses code review

**Prompt:**
```
Senior has completed a code review and identified issues in [FEATURE_NAME]_CODE_REVIEW.md.

Your job:
1. Read every comment in the code review
2. Address every single issue, suggestion, and concern
3. Make all requested changes
4. Fix all bugs identified
5. Refactor code as suggested
6. Don't stop until everything is addressed

Work through the review systematically. Check off each item as you complete it.
```

**Result:** All review items addressed

---

### Step 7: Test everything

- Test all functionality manually
- Fix bugs with Junior
- Move to next milestone when ready

---

## File Names Reference

**Phase 1 - Milestone Planning:**
- `MILESTONE_[N].md`
- `MILESTONE_REVIEW.md`
- (Milestone code reviews are output in chat, not as files)

**Final Review:**
- `FINAL_COMPREHENSIVE_REVIEW.md`

**Phase 2 - Detailed Feature Implementation (optional):**
- `[FEATURE]_IMPLEMENTATION_PLAN.md`
- `[FEATURE]_IMPLEMENTATION_PLAN_REVIEW.md`
- `[FEATURE]_IMPLEMENTATION_PLAN_V2.md`
- `[FEATURE]_CODE_REVIEW.md`

---

## Tips

**Getting Started:**
1. Assign agent roles FIRST using the prompts above
2. Keep agent prompts in separate Cursor windows/tabs for easy switching

**Primary Workflow (Phase 1):**
3. Most projects only need Phase 1 - milestone-based implementation
4. Copy Senior's full prompt into Cursor before reviews
5. Test thoroughly after each milestone
6. One milestone at a time

**Optional Workflow (Phase 2):**
7. Only use for very complex milestones that need detailed feature breakdown
8. Adds extra planning and review cycles

---

## Checklist

**Setup (do once per project):**
□ Junior engineer role assigned  
□ Senior engineer role assigned  

**Phase 1 - Primary Workflow (use for every milestone):**
□ Milestone planning doc created  
□ Milestone reviewed by Senior  
□ Milestone doc updated  
□ Milestone implemented  
□ Milestone code reviewed  
□ Review feedback addressed  
□ Milestone tested  
□ Move to next milestone

**Final Review (after all milestones complete):**
□ Senior comprehensive review completed  
□ All Critical issues fixed  
□ All High priority issues fixed  
□ All Medium priority issues fixed  
□ All Low priority issues fixed  
□ Application production-ready

**Phase 2 - Optional Detailed Feature Breakdown (only for complex milestones):**
□ Feature implementation plan created  
□ Plan reviewed by Senior  
□ V2 plan created with feedback  
□ Feature code implemented  
□ Code reviewed by Senior  
□ Review feedback addressed  
□ Feature tested
