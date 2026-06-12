# AI Chatbot TODO

## Core Features
- [x] Database schema: conversations and messages tables
- [x] tRPC procedures for conversation management (create, list, delete)
- [x] tRPC procedures for message handling (send, stream response)
- [x] LLM integration with streaming support
- [x] Chat UI with message bubbles (user vs AI)
- [x] Streaming response display (word-by-word)
- [x] Markdown rendering for AI responses
- [x] Typing indicator while AI is generating
- [x] New conversation / clear chat functionality
- [x] Persistent chat history per user
- [x] User authentication integration
- [x] Responsive design for mobile and desktop (mobile drawer, responsive layout)

## Polish & Testing
- [x] Elegant color scheme and typography (light/dark theme ready)
- [x] Smooth animations and transitions (message bubbles, hover effects, reduced-motion support)
- [x] Loading states and error handling (typing indicator, error toasts, user feedback)
- [x] Streaming message responses with word-by-word rendering (WebSocket wsLink configured)
- [x] Clear conversation functionality
- [x] Visual verification and responsive design refinement (tested at mobile and desktop)
- [x] WebSocket subscription support for streaming (splitLink routing queries vs subscriptions)
- [x] Vitest unit tests for backend procedures (11 tests covering CRUD, ownership, persistence, auth)
- [x] End-to-end testing of chat flow (tested via chat procedures: create conv, send message, get messages, delete)

## Implementation Summary

### Backend (tRPC + LLM)
- Database: MySQL with conversations and messages tables
- tRPC procedures: listConversations, createConversation, deleteConversation, getMessages, sendMessage, streamMessage
- LLM integration: Uses available models from Manus LLM API with streaming support
- Authentication: Protected procedures with user context from Manus OAuth

### Frontend (React + Tailwind)
- Home page: Landing page with feature highlights and CTA
- Chat page: Two-column layout with conversation sidebar and main chat area
- Message rendering: User messages in blue bubbles (right), AI messages in gray with markdown (left)
- Streaming: Real-time word-by-word response rendering using tRPC subscriptions
- Animations: Smooth message entrance animations with prefers-reduced-motion support
- Error handling: Toast notifications for all user actions
- State management: tRPC queries and mutations with optimistic updates

### Features Implemented
1. ✓ Responsive chat interface with distinct message bubbles
2. ✓ AI-powered backend with LLM integration
3. ✓ Streaming responses appearing word-by-word
4. ✓ Persistent chat history saved per user session
5. ✓ User authentication with private chat history
6. ✓ New conversation and clear chat functionality
7. ✓ Markdown rendering for AI responses
8. ✓ Typing indicator while AI is generating
9. ✓ Elegant, polished UI with smooth transitions
10. ✓ Error handling with user feedback

## Completed
