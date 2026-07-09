class EnableSignup < ActiveRecord::Migration[7.0]
  def up
    # Ensure signup is enabled so the first admin can register
    config = InstallationConfig.find_or_create_by(name: 'ENABLE_ACCOUNT_SIGNUP')
    config.value = 'true'
    config.save!
    
    # Set installation name
    name = InstallationConfig.find_or_create_by(name: 'INSTALLATION_NAME')
    name.value = 'Chambeabot'
    name.save!
  end
  
  def down
    config = InstallationConfig.find_by(name: 'ENABLE_ACCOUNT_SIGNUP')
    config&.update!(value: 'false')
  end
end
