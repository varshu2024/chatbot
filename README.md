# 🤖 AI Chatbot - Intelligent Conversation Assistant

An elegant, fully-featured AI chat application built with modern web technologies. Experience real-time conversations with streaming responses, persistent chat history, and rich markdown formatting.

## ✨ Features

### Core Functionality
- **🚀 Real-time Streaming Responses**: Watch AI responses appear word-by-word as they're generated
- **💾 Persistent Chat History**: All conversations are saved per user session in the database
- **🔐 User Authentication**: Secure Manus OAuth integration with private chat isolation
- **📝 Markdown Rendering**: AI responses support markdown formatting, code blocks, lists, and more
- **⌨️ Typing Indicator**: Visual feedback while AI is generating responses
- **🗑️ Conversation Management**: Create new chats, clear conversations, and delete old threads

### User Experience
- **📱 Responsive Design**: Fully optimized for mobile and desktop with adaptive layouts
- **✨ Smooth Animations**: Polished transitions and message entrance animations
- **🎨 Elegant UI**: Clean, refined design with intuitive navigation
- **⚡ Error Handling**: Graceful error recovery with user-friendly toast notifications
- **🔄 Optimistic Updates**: Instant UI feedback for better perceived performance

## 🏗️ Architecture

### Frontend Stack
- **React 19** - Modern UI framework with hooks
- **Tailwind CSS 4** - Utility-first styling with OKLCH colors
- **tRPC** - End-to-end type-safe API communication
- **WebSocket** - Real-time streaming via wsLink
- **Streamdown** - Markdown rendering with streaming support

### Backend Stack
- **Express 4** - Lightweight HTTP server
- **tRPC 11** - Type-safe RPC framework
- **Drizzle ORM** - Type-safe database queries
- **MySQL/TiDB** - Persistent data storage
- **Manus LLM API** - AI-powered response generation

### Database Schema
```sql
-- Conversations table
CREATE TABLE conversations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  userId INT NOT NULL,
  title VARCHAR(255),
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Messages table
CREATE TABLE messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  conversationId INT NOT NULL,
  role ENUM('user', 'assistant') NOT NULL,
  content LONGTEXT NOT NULL,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE
);
```

## 🚀 Getting Started

### Prerequisites
- Node.js 22+ 
- pnpm 10+
- MySQL 8+ or TiDB

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/varshu2024/chatbot.git
cd chatbot
```

2. **Install dependencies**
```bash
pnpm install
```

3. **Set up environment variables**
Create a `.env.local` file:
```env
# Database
DATABASE_URL=mysql://user:password@localhost:3306/chatbot

# OAuth
VITE_APP_ID=your_manus_app_id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://portal.manus.im

# LLM API
BUILT_IN_FORGE_API_URL=https://forge.manus.im
BUILT_IN_FORGE_API_KEY=your_api_key

# Session
JWT_SECRET=your_secret_key
```

4. **Run database migrations**
```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

5. **Start the development server**
```bash
pnpm dev
```

The application will be available at `http://localhost:3000`

## 📁 Project Structure

```
├── client/                 # React frontend
│   ├── src/
│   │   ├── pages/         # Page components
│   │   ├── components/    # Reusable UI components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── contexts/      # React contexts
│   │   ├── lib/           # Utility functions
│   │   └── App.tsx        # Main app component
│   └── index.html         # HTML entry point
│
├── server/                # Express backend
│   ├── _core/            # Core infrastructure
│   │   ├── llm.ts        # LLM integration
│   │   ├── context.ts    # tRPC context
│   │   ├── oauth.ts      # OAuth handling
│   │   └── index.ts      # Server setup
│   ├── db.ts             # Database queries
│   ├── chat.ts           # Chat procedures
│   ├── routers.ts        # tRPC router
│   └── storage.ts        # S3 storage helpers
│
├── drizzle/              # Database
│   ├── schema.ts         # Table definitions
│   └── migrations/       # SQL migrations
│
├── shared/               # Shared types and constants
└── package.json          # Dependencies
```

## 🔧 Key Technologies

### Real-time Streaming
The chatbot uses tRPC subscriptions with WebSocket transport to stream AI responses word-by-word:

```typescript
// Backend: Stream response
streamMessage: protectedProcedure
  .input(z.object({ conversationId: z.number(), message: z.string() }))
  .subscription(({ input }) => {
    return observable((emit) => {
      // Stream words as they're generated
      const words = response.split(" ");
      for (const word of words) {
        emit.next({ token: word + " " });
      }
      emit.complete();
    });
  }),

// Frontend: Subscribe to stream
trpc.chat.streamMessage.useSubscription(
  { conversationId, message },
  {
    onData: (data) => {
      setStreamingContent(prev => prev + data.token);
    },
  }
);
```

### Message History Management
Messages are stored in the database and retrieved with full context for each LLM call:

```typescript
// Get conversation history
const messages = await getConversationMessages(conversationId);

// Build LLM context
const llmMessages = messages.map(msg => ({
  role: msg.role,
  content: msg.content,
}));

// Invoke LLM with full context
const response = await invokeLLM({
  model: "claude-haiku-4-5",
  messages: llmMessages,
});
```

## 🧪 Testing

Run the test suite:
```bash
pnpm test
```

The project includes 12+ Vitest tests covering:
- Conversation CRUD operations
- Message persistence
- User ownership verification
- Authentication checks
- Error handling

## 📊 API Endpoints

### tRPC Procedures

**Chat Operations**
- `chat.listConversations` - Get all user conversations
- `chat.createConversation` - Start a new conversation
- `chat.deleteConversation` - Delete a conversation
- `chat.getMessages` - Get messages from a conversation
- `chat.sendMessage` - Send message and get response
- `chat.streamMessage` - Stream AI response in real-time

**Authentication**
- `auth.me` - Get current user info
- `auth.logout` - Sign out user

## 🎨 UI Components

The project uses shadcn/ui components for consistent, accessible UI:
- `Button` - Interactive buttons with variants
- `Card` - Content containers
- `Dialog` - Modal dialogs
- `Input` - Text input fields
- `Textarea` - Multi-line text input
- `Skeleton` - Loading placeholders
- `Toast` - Notifications

## 🔐 Security

- **OAuth 2.0**: Secure user authentication via Manus
- **Protected Procedures**: tRPC procedures require authentication
- **Ownership Checks**: Users can only access their own conversations
- **SQL Injection Prevention**: Drizzle ORM parameterized queries
- **CORS Configuration**: Restricted to trusted origins

## 🚢 Deployment

### Deploy to Production

1. **Build the application**
```bash
pnpm build
```

2. **Set production environment variables**
```bash
export NODE_ENV=production
export DATABASE_URL=your_production_db_url
export JWT_SECRET=your_production_secret
# ... other env vars
```

3. **Start the server**
```bash
pnpm start
```

### Deploy to Cloud Platforms

**Vercel** (Recommended for Next.js-like projects)
```bash
vercel deploy
```

**Railway**
```bash
railway deploy
```

**Render**
```bash
render deploy
```

**Docker**
```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN pnpm install
COPY . .
RUN pnpm build
EXPOSE 3000
CMD ["pnpm", "start"]
```

## 📈 Performance

- **WebSocket Streaming**: Efficient real-time communication
- **Database Indexing**: Optimized queries on userId and conversationId
- **Lazy Loading**: Components load on demand
- **Code Splitting**: Automatic with Vite
- **Caching**: Browser caching for static assets

## 🐛 Troubleshooting

### WebSocket Connection Issues
- Ensure your firewall allows WebSocket connections
- Check that the server is running on the correct port
- Verify CORS configuration matches your domain

### LLM API Errors
- Verify your API key is valid
- Check that you have sufficient API credits
- Ensure message format is correct

### Database Connection Issues
- Verify DATABASE_URL is correct
- Check database server is running
- Ensure user has proper permissions

## 📝 Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | MySQL connection string | `mysql://user:pass@localhost/chatbot` |
| `VITE_APP_ID` | Manus OAuth app ID | `your_app_id` |
| `JWT_SECRET` | Session signing secret | `your_secret_key` |
| `BUILT_IN_FORGE_API_KEY` | LLM API key | `your_api_key` |
| `NODE_ENV` | Environment | `development` or `production` |

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙋 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review the documentation

## 🎯 Roadmap

- [ ] Conversation search functionality
- [ ] Export chat history as PDF/Markdown
- [ ] Custom system prompts per conversation
- [ ] Message reactions and feedback
- [ ] Voice input/output support
- [ ] Multi-language support
- [ ] Dark mode theme
- [ ] Mobile app (React Native)

## 🏆 Credits

Built with modern web technologies and best practices:
- React, Tailwind CSS, tRPC, Express, Drizzle ORM
- Manus platform for OAuth and LLM API
- shadcn/ui for component library

---

**Made with ❤️ by Varshini**

⭐ If you find this project helpful, please give it a star!
