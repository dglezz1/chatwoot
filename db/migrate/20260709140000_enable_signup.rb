class EnableSignup < ActiveRecord::Migration[7.0]
  def up
    # Enable signup so first admin can register
    config = InstallationConfig.find_or_create_by(name: 'ENABLE_ACCOUNT_SIGNUP')
    config.value = 'true'
    config.save!
    
    # Set installation name to Chambeabot
    name = InstallationConfig.find_or_create_by(name: 'INSTALLATION_NAME')
    name.value = 'Chambeabot'
    name.save!

    # Mark all existing users as confirmed so they can log in immediately
    User.where(confirmed_at: nil).find_each do |user|
      user.update!(confirmed_at: Time.current, confirmation_sent_at: Time.current)
    end
  end
  
  def down
    config = InstallationConfig.find_by(name: 'ENABLE_ACCOUNT_SIGNUP')
    config&.update!(value: 'false')
  end
end
