export const runMockAgent = async (history) => {
  const lastMessage = history[history.length - 1];

  return {
    reply: `Mock response: I received your message: "${lastMessage.content}"`,
    sources: []
  };
};