# Google Workspace Shared Contacts Manager

A modern web application for Google Workspace administrators to manage shared directory contacts, including advanced duplicate detection and removal capabilities.

## Features

- ✨ **Modern UI**: Clean, responsive interface with Google Material Design inspiration
- 📇 **Contact Management**: Create, read, update, and delete shared contacts
- 🔍 **Advanced Search**: Real-time search across names, emails, phone numbers, and notes
- 👥 **Duplicate Detection**: Smart algorithm to find potential duplicates with adjustable similarity threshold
- 🗑️ **Duplicate Removal**: Easy-to-use tools for removing duplicate contacts
- 📁 **Bulk Import**: CSV file upload with preview and validation
- 🔐 **Secure Authentication**: Service account-based authentication with domain-wide delegation
- 📱 **Responsive Design**: Works perfectly on desktop, tablet, and mobile devices

## Prerequisites

Before setting up this application, you need:

1. **Google Workspace Admin Access**: Super administrator privileges
2. **Google Cloud Project**: With billing enabled
3. **Python 3.8+**: For running the Flask application

## Setup Instructions

### Step 1: Google Cloud Project Setup

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Note your project ID

2. **Enable Required APIs**
   - Go to APIs & Services > Library
   - Enable the following APIs:
     - Admin SDK API
     - Google Workspace Domain Shared Contacts API

3. **Create a Service Account**
   - Go to IAM & Admin > Service Accounts
   - Click "Create Service Account"
   - Name: `workspace-contacts-manager`
   - Description: `Service account for managing shared contacts`
   - Click "Create and Continue"
   - Grant the role: `Service Account User`
   - Click "Done"

4. **Generate Service Account Key**
   - Click on your newly created service account
   - Go to the "Keys" tab
   - Click "Add Key" > "Create new key"
   - Select "JSON" format
   - Download the file and save it as `credentials.json` in your project directory

5. **Note the Client ID**
   - In the service account details, copy the "Client ID" (long numeric string)
   - You'll need this for domain-wide delegation

### Step 2: Google Workspace Admin Console Setup

1. **Enable Domain Shared Contacts**
   - Go to [Google Admin Console](https://admin.google.com/)
   - Navigate to Directory > Directory Settings
   - Find "Contact sharing" settings
   - Enable "Enable contact sharing" checkbox
   - Click "Save"

2. **Set Up Domain-Wide Delegation**
   - Go to Security > Access and data control > API controls
   - Click "Manage Domain Wide Delegation"
   - Click "Add new"
   - **Client ID**: Paste the service account Client ID from Step 1.5
   - **OAuth Scopes**: Enter the following scopes (comma-separated):
     ```
     https://www.googleapis.com/auth/admin.directory.user,https://www.googleapis.com/auth/admin.directory.group
     ```
   - Click "Authorize"

### Step 3: Application Setup

1. **Clone or Download the Application**
   ```bash
   # If you have the files, navigate to the project directory
   cd google-workspace-contacts-manager
   ```

2. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure Environment Variables**
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Edit the .env file with your configuration
   nano .env
   ```

   Update the `.env` file with your values:
   ```
   WORKSPACE_DOMAIN=your-domain.com
   SERVICE_ACCOUNT_FILE=credentials.json
   ADMIN_EMAIL=admin@your-domain.com
   FLASK_ENV=development
   FLASK_DEBUG=True
   ```

4. **Place Your Credentials File**
   - Ensure your `credentials.json` file is in the project root directory
   - This file contains your service account private key

### Step 4: Run the Application

1. **Start the Flask Application**
   ```bash
   python app.py
   ```

2. **Access the Application**
   - Open your web browser
   - Navigate to `http://localhost:5000`
   - You should see the Google Workspace Contacts Manager interface

## Usage Guide

### Managing Contacts

1. **View Contacts**
   - Click the "Contacts" tab
   - Use the search box to filter contacts
   - Click "Refresh" to reload from Google Workspace

2. **Add New Contact**
   - Click the "Add Contact" tab
   - Fill in the required fields (First Name, Last Name, Email)
   - Optionally add additional information
   - Click "Create Contact"

3. **Edit Contact**
   - In the Contacts tab, click the edit (pencil) icon on any contact
   - Modify the information in the modal dialog
   - Click "Update Contact"

4. **Delete Contact**
   - In the Contacts tab, click the delete (trash) icon on any contact
   - Confirm the deletion in the dialog

### Finding and Removing Duplicates

1. **Find Duplicates**
   - Click the "Find Duplicates" tab
   - Adjust the similarity threshold (50% - 100%)
   - Click "Find Duplicates"

2. **Review Duplicates**
   - Review the potential duplicate pairs
   - Each pair shows a similarity percentage
   - Compare the contact information side by side

3. **Remove Duplicates**
   - Click "Remove First" or "Remove Second" to delete one of the duplicates
   - Or click "Edit First" or "Edit Second" to modify before deciding

### Bulk Import

1. **Prepare CSV File**
   - Create a CSV file with required columns: `first_name`, `last_name`, `email`
   - Optional columns: `phone`, `notes`, `display_name`
   - Example:
     ```csv
     first_name,last_name,email,phone,notes
     John,Doe,john.doe@example.com,555-0123,Sales representative
     Jane,Smith,jane.smith@example.com,555-0124,Marketing manager
     ```

2. **Import Contacts**
   - Click the "Bulk Import" tab
   - Drag and drop your CSV file or click to browse
   - Review the preview table
   - Click "Import Contacts"

## API Endpoints

The application provides RESTful API endpoints:

- `GET /api/contacts` - List all contacts
- `POST /api/contacts` - Create a new contact
- `PUT /api/contacts/update` - Update an existing contact
- `DELETE /api/contacts/delete` - Delete a contact
- `GET /api/duplicates` - Find duplicate contacts
- `POST /api/duplicates/remove` - Remove duplicate contacts
- `GET /api/health` - Health check endpoint

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Verify your `credentials.json` file is valid
   - Ensure domain-wide delegation is properly configured
   - Check that the service account has the correct scopes

2. **Permission Denied**
   - Verify you have super administrator privileges
   - Ensure the Domain Shared Contacts API is enabled
   - Check that "Contact sharing" is enabled in Admin Console

3. **No Contacts Found**
   - Verify that you have existing shared contacts in your domain
   - Try creating a test contact through the application
   - Check the browser console for error messages

4. **Import Errors**
   - Ensure your CSV file has the required columns
   - Check for proper UTF-8 encoding
   - Verify email addresses are in valid format

### Error Messages

- **"API connection failed"**: Check your internet connection and Google Cloud project status
- **"Authentication failed"**: Verify your service account credentials and domain-wide delegation
- **"Failed to retrieve contacts"**: Check API permissions and domain settings

## Security Considerations

- **Credentials Protection**: Never commit `credentials.json` to version control
- **Environment Variables**: Use environment variables for sensitive configuration
- **Access Control**: Restrict access to the application to authorized administrators only
- **HTTPS**: In production, use HTTPS to encrypt traffic

## Production Deployment

For production deployment:

1. **Use a Production WSGI Server**
   ```bash
   pip install gunicorn
   gunicorn -w 4 -b 0.0.0.0:8000 app:app
   ```

2. **Set Environment Variables**
   ```bash
   export FLASK_ENV=production
   export FLASK_DEBUG=False
   ```

3. **Configure Reverse Proxy**
   - Use nginx or Apache as a reverse proxy
   - Enable HTTPS with SSL certificates
   - Set up proper logging and monitoring

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:

1. Check the troubleshooting section above
2. Review Google Workspace Admin SDK documentation
3. Check Google Cloud Console for API quotas and errors
4. Create an issue in the project repository

## Version History

- **v1.0.0** - Initial release with core functionality
  - Contact management (CRUD operations)
  - Duplicate detection and removal
  - Bulk CSV import
  - Modern responsive UI
  - Service account authentication

## Related Resources

- [Google Workspace Admin SDK Documentation](https://developers.google.com/admin-sdk)
- [Domain Shared Contacts API](https://developers.google.com/admin-sdk/domain-shared-contacts)
- [Google Cloud Service Accounts](https://cloud.google.com/iam/docs/service-accounts)
- [Google Workspace Admin Console](https://admin.google.com/)
