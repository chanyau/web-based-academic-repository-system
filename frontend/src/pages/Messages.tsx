import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  MessageSquare, 
  Send, 
  FileText,
  CheckCircle,
  AlertCircle,
  Loader
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { messageService, Message, Conversation } from '../services/messageService';

export const Messages = () => {
  const { projectId } = useParams();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Conversation | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations list
  useEffect(() => {
    loadConversations();
  }, []);

  // Load messages when projectId changes
  useEffect(() => {
    if (projectId) {
      loadMessages(projectId);
    }
  }, [projectId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const data = await messageService.getConversations();
      setConversations(data);
      
      // If we have a projectId, find and select that conversation
      if (projectId) {
        const selected = data.find(c => c.project_id.toString() === projectId);
        setSelectedProject(selected || null);
      }
    } catch (err: any) {
      console.error('Error loading conversations:', err);
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (projId: string) => {
    try {
      const data = await messageService.getMessages(projId);
      setMessages(data);
      
      // Find the conversation for display
      const selected = conversations.find(c => c.project_id.toString() === projId);
      setSelectedProject(selected || null);
    } catch (err: any) {
      console.error('Error loading messages:', err);
      setError('Failed to load messages');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !projectId) return;

    try {
      setSending(true);
      const message = await messageService.sendMessage(projectId, newMessage.trim());
      setMessages([...messages, message]);
      setNewMessage('');
    } catch (err: any) {
      console.error('Error sending message:', err);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'under_review':
        return 'bg-blue-100 text-blue-800';
      case 'revision_requested':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-blue-900 mb-2">Messages</h1>
          <p className="text-gray-600">
            {user?.role === 'student' 
              ? 'Communicate with your project supervisor'
              : 'Provide feedback and guidance to students'}
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center space-x-2">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg overflow-hidden" style={{ height: 'calc(100vh - 250px)' }}>
          <div className="grid grid-cols-3 h-full">
            {/* Conversations List */}
            <div className="col-span-1 border-r border-gray-200 overflow-y-auto">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h2 className="font-semibold text-gray-900">Conversations</h2>
              </div>
              
              {conversations.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageSquare className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 text-sm">No conversations yet</p>
                  {user?.role === 'student' && (
                    <p className="text-gray-400 text-xs mt-2">
                      Submit a project to start a conversation with your supervisor
                    </p>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {conversations.map((conv) => (
                    <Link
                      key={conv.project_id}
                      to={`/messages/${conv.project_id}`}
                      className={`block p-4 hover:bg-gray-50 transition-colors ${
                        projectId === conv.project_id.toString() ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-gray-900 truncate text-sm">
                            {conv.project_title}
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">
                            {conv.other_party?.name || 'No supervisor assigned'}
                          </p>
                        </div>
                        {conv.unread_count > 0 && (
                          <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5 ml-2">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(conv.project_status)}`}>
                          {conv.project_status.replace('_', ' ')}
                        </span>
                        {conv.last_message && (
                          <span className="text-xs text-gray-400">
                            {formatTime(conv.last_message.created_at)}
                          </span>
                        )}
                      </div>
                      
                      {conv.last_message && (
                        <p className="text-xs text-gray-500 mt-2 truncate">
                          {conv.last_message.content}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Messages Panel */}
            <div className="col-span-2 flex flex-col h-full">
              {projectId ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {selectedProject?.project_title || 'Loading...'}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {selectedProject?.other_party 
                            ? `${user?.role === 'student' ? 'Supervisor' : 'Student'}: ${selectedProject.other_party.name}`
                            : 'No participant assigned'}
                        </p>
                      </div>
                      <Link 
                        to={`/projects/${projectId}`}
                        className="flex items-center space-x-1 text-blue-600 hover:text-blue-700 text-sm"
                      >
                        <FileText className="h-4 w-4" />
                        <span>View Project</span>
                      </Link>
                    </div>
                  </div>

                  {/* Messages List */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.length === 0 ? (
                      <div className="text-center py-12">
                        <MessageSquare className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500">No messages yet</p>
                        <p className="text-gray-400 text-sm mt-1">
                          Start the conversation by sending a message
                        </p>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isOwnMessage = msg.sender.id === user?.id || 
                          (user?.id && msg.sender.id.toString() === user.id.toString());
                        
                        return (
                          <div
                            key={msg.id}
                            className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-xs lg:max-w-md ${isOwnMessage ? 'order-2' : ''}`}>
                              <div className={`flex items-center space-x-2 mb-1 ${isOwnMessage ? 'justify-end' : ''}`}>
                                <span className="text-xs text-gray-500">{msg.sender_name}</span>
                                <span className="text-xs text-gray-400">{formatTime(msg.created_at)}</span>
                              </div>
                              <div
                                className={`px-4 py-3 rounded-2xl ${
                                  isOwnMessage
                                    ? 'bg-blue-600 text-white rounded-br-md'
                                    : 'bg-gray-100 text-gray-900 rounded-bl-md'
                                }`}
                              >
                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                              </div>
                              {isOwnMessage && msg.is_read && (
                                <div className="flex justify-end mt-1">
                                  <CheckCircle className="h-3 w-3 text-blue-400" />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Message Input */}
                  <div className="p-4 border-t border-gray-200 bg-gray-50">
                    <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
                      <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
                        className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        disabled={sending}
                      />
                      <button
                        type="submit"
                        disabled={!newMessage.trim() || sending}
                        className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sending ? (
                          <Loader className="h-5 w-5 animate-spin" />
                        ) : (
                          <Send className="h-5 w-5" />
                        )}
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <MessageSquare className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500">Select a conversation to view messages</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
