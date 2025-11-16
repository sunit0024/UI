import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, X, Settings, Minimize2, Download, ExternalLink } from 'lucide-react';

const Chatbot = ({
  // API Configuration
  apiUrl = 'http://localhost:8000',
  userId = 'default',
  
  // Appearance
  position = 'bottom-right',
  theme = 'light',
  primaryColor = '#007bff',
  botName = 'MCP Assistant',
  botAvatar = null,
  userAvatar = null,
  welcomeMessage = 'Hello! I\'m your MCP-powered assistant. How can I help you today?',
  placeholder = 'Type your message...',
  
  // Dimensions
  width = '400px',
  height = '600px',
  buttonSize = '60px',
  
  // Behavior
  autoOpen = false,
  showSettings = false,
  typingIndicatorDelay = 500,
  
  // Callbacks
  onMessageSent = null,
  onMessageReceived = null,
  onError = null,
  onOpen = null,
  onClose = null,
  
  // Advanced
  persistMessages = true,
  maxMessages = 100
}) => {
  const [isOpen, setIsOpen] = useState(autoOpen);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: welcomeMessage, sender: 'bot', timestamp: new Date() }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [localApiUrl, setLocalApiUrl] = useState(apiUrl);
  const [sessionId, setSessionId] = useState(null);
  const [toolsUsed, setToolsUsed] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Theme colors
  const themes = {
    light: {
      background: '#f8f9fa',
      messageBackground: '#ffffff',
      text: '#000000',
      border: '#e0e0e0'
    },
    dark: {
      background: '#1a1a1a',
      messageBackground: '#2d2d2d',
      text: '#ffffff',
      border: '#404040'
    }
  };

  const currentTheme = themes[theme] || themes.light;

  // Position styles
  const positionStyles = {
    'bottom-right': { bottom: '20px', right: '20px' },
    'bottom-left': { bottom: '20px', left: '20px' },
    'top-right': { top: '20px', right: '20px' },
    'top-left': { top: '20px', left: '20px' }
  };

  // Function to parse and format message text with links
  const formatMessageWithLinks = (text) => {
    // URL regex pattern
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    // Check if the message contains download/file keywords
    const isDownloadLink = text.toLowerCase().includes('download') || 
                          text.toLowerCase().includes('file') || 
                          text.toLowerCase().includes('excel') ||
                          text.toLowerCase().includes('csv') ||
                          text.toLowerCase().includes('report');
    
    // Split text by URLs
    const parts = text.split(urlRegex);
    
    return parts.map((part, index) => {
      // Check if this part is a URL
      if (part.match(urlRegex)) {
        // Determine link text based on context
        let linkText = 'Link';
        if (isDownloadLink) {
          linkText = 'Download File';
        } else if (part.includes('report')) {
          linkText = 'View Report';
        } else if (part.includes('document')) {
          linkText = 'Open Document';
        }
        
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#0066cc',
              textDecoration: 'underline',
              fontWeight: 'bold',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer'
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#0052a3';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = '#0066cc';
            }}
          >
            {isDownloadLink ? <Download size={14} /> : <ExternalLink size={14} />}
            {linkText}
          </a>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  // Auto-scroll
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isMinimized]);

  // Load persisted session on mount
  useEffect(() => {
    if (persistMessages) {
      const savedSessionId = localStorage.getItem('mcp_session_id');
      if (savedSessionId) {
        setSessionId(savedSessionId);
      }
    }
  }, [persistMessages]);

  // Check health when opened
  useEffect(() => {
    if (isOpen) {
      checkHealth();
    }
  }, [isOpen]);

  const checkHealth = async () => {
    try {
      const response = await fetch(`${localApiUrl}/health`);
      const data = await response.json();
      console.log('MCP Service health:', data);
    } catch (error) {
      console.error('Health check failed:', error);
      if (onError) onError(error);
    }
  };

  const sendMessage = async (userMessage) => {
    try {
      const payload = {
        message: userMessage,
        session_id: sessionId,
        client_code: 'CLIENT1181',
        user_id: userId
      };

      const response = await fetch(`${localApiUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to get response');
      }

      // Update session ID if new
      if (data.session_id && !sessionId) {
        setSessionId(data.session_id);
        if (persistMessages) {
          localStorage.setItem('mcp_session_id', data.session_id);
        }
      }

      // Track tools used
      if (data.tools_used && data.tools_used.length > 0) {
        setToolsUsed(prev => [...new Set([...prev, ...data.tools_used])]);
      }

      return {
        message: data.message,
        toolCallsCount: data.tool_calls_count || 0,
        toolsUsed: data.tools_used || []
      };
    } catch (error) {
      console.error('API call failed:', error);
      throw error;
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    const newUserMessage = {
      id: Date.now(),
      text: userMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => {
      const updated = [...prev, newUserMessage];
      return updated.slice(-maxMessages);
    });
    setInputValue('');
    setIsLoading(true);

    if (onMessageSent) {
      onMessageSent(userMessage);
    }

    try {
      await new Promise(resolve => setTimeout(resolve, typingIndicatorDelay));

      const result = await sendMessage(userMessage);
      
      let botMessageText = result.message;
      
      // Add tool usage info if tools were used
      if (result.toolCallsCount > 0) {
        botMessageText += `\n\n🔧 Used ${result.toolCallsCount} tool call(s): ${result.toolsUsed.join(', ')}`;
      }

      const newBotMessage = {
        id: Date.now() + 1,
        text: botMessageText,
        sender: 'bot',
        timestamp: new Date(),
        toolsUsed: result.toolsUsed
      };

      setMessages(prev => {
        const updated = [...prev, newBotMessage];
        return updated.slice(-maxMessages);
      });

      if (onMessageReceived) {
        onMessageReceived(result.message);
      }
    } catch (error) {
      console.error('Error:', error);
      
      const errorMessage = {
        id: Date.now() + 1,
        text: 'Sorry, I encountered an error. Please try again. Make sure the MCP service is running on port 8000.',
        sender: 'bot',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);

      if (onError) {
        onError(error);
      }
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleChat = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    if (newState && onOpen) onOpen();
    if (!newState && onClose) onClose();
  };

  const clearMessages = () => {
    setMessages([
      { id: 1, text: welcomeMessage, sender: 'bot', timestamp: new Date() }
    ]);
    setSessionId(null);
    setToolsUsed([]);
    if (persistMessages) {
      localStorage.removeItem('mcp_session_id');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      ...positionStyles[position],
      zIndex: 9999,
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* Chat Window */}
      {isOpen && (
        <div style={{
          width,
          height: isMinimized ? 'auto' : height,
          marginBottom: '10px',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          backgroundColor: currentTheme.messageBackground,
          display: 'flex',
          flexDirection: 'column'
        }}>
          {/* Header */}
          <div style={{
            padding: '15px',
            backgroundColor: primaryColor,
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {botAvatar ? (
                <img src={botAvatar} alt="Bot" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
              ) : (
                <Bot size={24} />
              )}
              <div>
                <div style={{ fontWeight: 'bold' }}>{botName}</div>
                {sessionId && (
                  <div style={{ fontSize: '10px', opacity: 0.8 }}>
                    Session: {sessionId.slice(0, 8)}...
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {showSettings && (
                <button
                  onClick={() => setShowSettingsPanel(!showSettingsPanel)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'white',
                    cursor: 'pointer',
                    padding: '0'
                  }}
                >
                  <Settings size={18} />
                </button>
              )}
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  padding: '0'
                }}
              >
                <Minimize2 size={18} />
              </button>
              <button
                onClick={toggleChat}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer',
                  padding: '0'
                }}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Settings Panel */}
              {showSettingsPanel && (
                <div style={{
                  padding: '15px',
                  backgroundColor: currentTheme.background,
                  borderBottom: `1px solid ${currentTheme.border}`
                }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontSize: '12px', fontWeight: '600', color: currentTheme.text }}>
                    MCP Service URL:
                  </label>
                  <input
                    type="text"
                    value={localApiUrl}
                    onChange={(e) => setLocalApiUrl(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px',
                      border: `1px solid ${currentTheme.border}`,
                      borderRadius: '6px',
                      fontSize: '13px',
                      backgroundColor: currentTheme.messageBackground,
                      color: currentTheme.text,
                      marginBottom: '8px'
                    }}
                  />
                  {toolsUsed.length > 0 && (
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '12px', fontWeight: '600', color: currentTheme.text, marginBottom: '4px' }}>
                        Tools Used This Session:
                      </div>
                      <div style={{ fontSize: '11px', color: '#6c757d' }}>
                        {toolsUsed.join(', ')}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={clearMessages}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    Clear Session & Messages
                  </button>
                </div>
              )}

              {/* Messages */}
              <div style={{
                flex: 1,
                overflowY: 'auto',
                padding: '20px',
                backgroundColor: currentTheme.background,
                display: 'flex',
                flexDirection: 'column',
                gap: '16px'
              }}>
                {messages.map((message) => (
                  <div
                    key={message.id}
                    style={{
                      display: 'flex',
                      gap: '10px',
                      alignItems: 'flex-start',
                      flexDirection: message.sender === 'user' ? 'row-reverse' : 'row'
                    }}
                  >
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: message.sender === 'bot' ? primaryColor : '#6c757d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {message.sender === 'bot' ? (
                        botAvatar ? <img src={botAvatar} alt="Bot" style={{ width: '100%', height: '100%', borderRadius: '50%' }} /> : <Bot size={20} color="white" />
                      ) : (
                        userAvatar ? <img src={userAvatar} alt="User" style={{ width: '100%', height: '100%', borderRadius: '50%' }} /> : <User size={20} color="white" />
                      )}
                    </div>

                    <div style={{
                      maxWidth: '70%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{
                        padding: '12px 16px',
                        borderRadius: message.sender === 'user' 
                          ? '18px 18px 4px 18px' 
                          : '18px 18px 18px 4px',
                        backgroundColor: message.sender === 'user' ? primaryColor : currentTheme.messageBackground,
                        color: message.sender === 'user' ? '#ffffff' : currentTheme.text,
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        wordWrap: 'break-word',
                        whiteSpace: 'pre-wrap',
                        lineHeight: '1.5'
                      }}>
                        {message.sender === 'bot' ? formatMessageWithLinks(message.text) : message.text}
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div style={{
                    display: 'flex',
                    gap: '10px',
                    alignItems: 'flex-start'
                  }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      backgroundColor: primaryColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Bot size={20} color="white" />
                    </div>
                    <div style={{
                      padding: '12px 16px',
                      borderRadius: '18px 18px 18px 4px',
                      backgroundColor: currentTheme.messageBackground,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                      display: 'flex',
                      gap: '4px'
                    }}>
                      {[0, 0.2, 0.4].map((delay, i) => (
                        <span key={i} style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: primaryColor,
                          animation: 'bounce 1.4s infinite ease-in-out both',
                          animationDelay: `${delay}s`
                        }}></span>
                      ))}
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div style={{
                padding: '16px',
                backgroundColor: currentTheme.messageBackground,
                borderTop: `1px solid ${currentTheme.border}`
              }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={placeholder}
                    disabled={isLoading}
                    style={{
                      flex: 1,
                      padding: '12px 16px',
                      border: `1px solid ${currentTheme.border}`,
                      borderRadius: '24px',
                      fontSize: '14px',
                      outline: 'none',
                      backgroundColor: isLoading ? currentTheme.background : currentTheme.messageBackground,
                      color: currentTheme.text
                    }}
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || isLoading}
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      border: 'none',
                      backgroundColor: inputValue.trim() && !isLoading ? primaryColor : '#e0e0e0',
                      color: 'white',
                      cursor: inputValue.trim() && !isLoading ? 'pointer' : 'not-allowed',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s'
                    }}
                  >
                    <Send size={20} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Toggle Button */}
      <button
        onClick={toggleChat}
        style={{
          width: buttonSize,
          height: buttonSize,
          borderRadius: '50%',
          backgroundColor: primaryColor,
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          transition: 'transform 0.2s',
          marginLeft: 'auto',
          color: 'white'
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        {isOpen ? <X size={28} /> : <Bot size={28} />}
      </button>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
            opacity: 0.5;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default Chatbot;