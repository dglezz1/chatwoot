module OperatorAgent
  # Registry of available tools for the Operator Agent.
  #
  # Tools are auto-discovered from app/services/operator_agent/tools/.
  # Any class that subclasses OperatorAgent::Tools::BaseTool is
  # automatically registered — no need to maintain a TOOL_CLASSES
  # array. This prevents the "added a new tool but forgot to
  # register it" class of bug and removes the need for multiple
  # coders to coordinate edits to a shared file.
  class ToolRegistry
    TOOLS_DIR = Rails.root.join('app/services/operator_agent/tools')

    # Returns tool class names (strings) so the LLM can reference
    # them safely without triggering autoload at class-load time.
    def self.tool_class_names
      Dir[TOOLS_DIR.join('*_tool.rb')].map do |path|
        # Convert "list_inboxes_tool.rb" → "OperatorAgent::Tools::ListInboxesTool"
        base = File.basename(path, '.rb')
        # Camelize each underscore segment, preserving the :: scoping
        parts = base.split('_').map { |seg| seg[0].upcase + seg[1..] }
        klass_name = parts.join
        "OperatorAgent::Tools::#{klass_name}"
      end.uniq
    end

    def self.tools_for(account:, user:)
      tool_class_names.filter_map do |name|
        klass = name.safe_constantize
        next unless klass
        next if klass == OperatorAgent::Tools::BaseTool # skip the base class itself
        klass.new(account: account, user: user)
      end
    end

    def self.capabilities
      tool_class_names.filter_map do |name|
        klass = name.safe_constantize
        next unless klass
        next if klass == OperatorAgent::Tools::BaseTool
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
      return name if name.is_a?(Class)

      # Pending actions store the short tool name ("update_label").
      # The class lives at OperatorAgent::Tools::UpdateLabelTool.
      # Walk the registry and match on the short name.
      tool_class_names.each do |full_name|
        klass = full_name.safe_constantize
        next unless klass
        short = klass.name.demodulize.delete_suffix('Tool').underscore
        return klass if short == name.to_s
        # Also match the agents-gem name (operator_agent--tools--update_label)
        return klass if klass.allocate.name == name.to_s
      end
      nil
    end
  end
end
