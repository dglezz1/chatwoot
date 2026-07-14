module OperatorAgent
  # Registry of available tools for the Operator Agent.
  #
  # Phase 1: 5 read-only tools are always available.
  # Phase 2+: registry grows with write tools (some require confirmation).
  # Phase 3+: setup-flow tools added (WhatsApp OpenWA, Captain binding, etc.)
  #
  # Tools are simple Ruby classes extending OperatorAgent::Tools::BaseTool.
  # The registry instantiates them with the right account+user and passes
  # them to the agents gem.
  class ToolRegistry
    TOOL_CLASSES = [
      OperatorAgent::Tools::ListInboxesTool,
      OperatorAgent::Tools::GetInboxTool,
      OperatorAgent::Tools::ListContactsTool,
      OperatorAgent::Tools::ListAgentsTool,
      OperatorAgent::Tools::ListLabelsTool
    ].freeze

    def self.tools_for(account:, user:)
      TOOL_CLASSES.map { |klass| klass.new(account: account, user: user) }
    end

    def self.capabilities
      TOOL_CLASSES.map do |klass|
        instance = klass.allocate
        {
          name: instance.name,
          description: instance.description.to_s,
          destructive: klass.respond_to?(:destructive?) && klass.destructive?,
          permissions: instance.permissions
        }
      end
    end

    def self.find_tool_class(name)
      normalized = name.to_s.gsub(/(?:^|_)([a-z])/) { Regexp.last_match(1).upcase }
      "OperatorAgent::Tools::#{normalized}Tool".safe_constantize
    end
  end
end
