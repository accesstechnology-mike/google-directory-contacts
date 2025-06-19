import os
import json
import re
import xml.etree.ElementTree as ET
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from google.auth.transport.requests import Request
from google.oauth2 import service_account
import requests
from difflib import SequenceMatcher
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuration
SCOPES = ['https://www.googleapis.com/auth/admin.directory.user']
SERVICE_ACCOUNT_FILE = os.getenv('SERVICE_ACCOUNT_FILE', 'credentials.json')
DOMAIN = os.getenv('WORKSPACE_DOMAIN', 'example.com')

class GoogleWorkspaceContactsManager:
    def __init__(self, service_account_file, domain):
        self.domain = domain
        self.credentials = None
        self.load_credentials(service_account_file)
    
    def load_credentials(self, service_account_file):
        """Load service account credentials"""
        try:
            self.credentials = service_account.Credentials.from_service_account_file(
                service_account_file, scopes=SCOPES
            )
            # For domain-wide delegation, we need to specify the admin user
            admin_email = os.getenv('ADMIN_EMAIL')
            if admin_email:
                self.credentials = self.credentials.with_subject(admin_email)
        except Exception as e:
            print(f"Error loading credentials: {e}")
    
    def get_auth_headers(self):
        """Get authorization headers for API requests"""
        if not self.credentials:
            return None
        
        self.credentials.refresh(Request())
        return {
            'Authorization': f'Bearer {self.credentials.token}',
            'GData-Version': '3.0',
            'Content-Type': 'application/atom+xml'
        }
    
    def create_contact_xml(self, contact_data):
        """Create XML for a new contact"""
        xml_template = """<?xml version='1.0' encoding='UTF-8'?>
<atom:entry xmlns:atom='http://www.w3.org/2005/Atom'
    xmlns:gd='http://schemas.google.com/g/2005'>
  <atom:category scheme='http://schemas.google.com/g/2005#kind'
    term='http://schemas.google.com/contact/2008#contact' />
  <gd:name>
     <gd:givenName>{first_name}</gd:givenName>
     <gd:familyName>{last_name}</gd:familyName>
     <gd:fullName>{full_name}</gd:fullName>
  </gd:name>
  <atom:content type='text'>{notes}</atom:content>
  <gd:email rel='http://schemas.google.com/g/2005#work'
    primary='true'
    address='{email}' displayName='{display_name}' />
  {additional_emails}
  {phone_numbers}
  {address}
</atom:entry>"""
        
        # Build additional emails
        additional_emails = ""
        if contact_data.get('additional_emails'):
            for email in contact_data['additional_emails']:
                additional_emails += f"""<gd:email rel='http://schemas.google.com/g/2005#home'
    address='{email}' />"""
        
        # Build phone numbers
        phone_numbers = ""
        if contact_data.get('phone'):
            phone_numbers += f"""<gd:phoneNumber rel='http://schemas.google.com/g/2005#work'
    primary='true'>{contact_data['phone']}</gd:phoneNumber>"""
        
        # Build address
        address = ""
        if contact_data.get('address'):
            addr = contact_data['address']
            address = f"""<gd:structuredPostalAddress
      rel='http://schemas.google.com/g/2005#work'
      primary='true'>
    <gd:city>{addr.get('city', '')}</gd:city>
    <gd:street>{addr.get('street', '')}</gd:street>
    <gd:region>{addr.get('region', '')}</gd:region>
    <gd:postcode>{addr.get('postcode', '')}</gd:postcode>
    <gd:country>{addr.get('country', '')}</gd:country>
  </gd:structuredPostalAddress>"""
        
        return xml_template.format(
            first_name=contact_data.get('first_name', ''),
            last_name=contact_data.get('last_name', ''),
            full_name=f"{contact_data.get('first_name', '')} {contact_data.get('last_name', '')}".strip(),
            notes=contact_data.get('notes', ''),
            email=contact_data.get('email', ''),
            display_name=contact_data.get('display_name', contact_data.get('email', '')),
            additional_emails=additional_emails,
            phone_numbers=phone_numbers,
            address=address
        )
    
    def parse_contact_xml(self, xml_string):
        """Parse contact XML to extract contact data"""
        try:
            root = ET.fromstring(xml_string)
            
            # Define namespaces
            namespaces = {
                'atom': 'http://www.w3.org/2005/Atom',
                'gd': 'http://schemas.google.com/g/2005'
            }
            
            contact = {}
            
            # Extract basic info
            name_elem = root.find('gd:name', namespaces)
            if name_elem is not None:
                contact['first_name'] = getattr(name_elem.find('gd:givenName', namespaces), 'text', '')
                contact['last_name'] = getattr(name_elem.find('gd:familyName', namespaces), 'text', '')
                contact['full_name'] = getattr(name_elem.find('gd:fullName', namespaces), 'text', '')
            
            # Extract ID and edit link
            contact['id'] = root.find('atom:id', namespaces).text if root.find('atom:id', namespaces) is not None else ''
            
            edit_link = root.find(".//atom:link[@rel='edit']", namespaces)
            if edit_link is not None:
                contact['edit_url'] = edit_link.get('href', '')
            
            # Extract emails
            emails = []
            for email_elem in root.findall('gd:email', namespaces):
                email_data = {
                    'address': email_elem.get('address', ''),
                    'primary': email_elem.get('primary', 'false') == 'true',
                    'rel': email_elem.get('rel', '')
                }
                emails.append(email_data)
            contact['emails'] = emails
            
            # Extract phone numbers
            phones = []
            for phone_elem in root.findall('gd:phoneNumber', namespaces):
                phone_data = {
                    'number': phone_elem.text or '',
                    'primary': phone_elem.get('primary', 'false') == 'true',
                    'rel': phone_elem.get('rel', '')
                }
                phones.append(phone_data)
            contact['phones'] = phones
            
            # Extract notes
            content_elem = root.find('atom:content', namespaces)
            contact['notes'] = content_elem.text if content_elem is not None else ''
            
            return contact
        except Exception as e:
            print(f"Error parsing contact XML: {e}")
            return None
    
    def get_contacts(self):
        """Retrieve all shared contacts"""
        url = f"https://www.google.com/m8/feeds/contacts/{self.domain}/full"
        headers = self.get_auth_headers()
        
        if not headers:
            return {"error": "Authentication failed"}
        
        try:
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                # Parse XML response
                root = ET.fromstring(response.text)
                namespaces = {
                    'atom': 'http://www.w3.org/2005/Atom',
                    'gd': 'http://schemas.google.com/g/2005'
                }
                
                contacts = []
                for entry in root.findall('atom:entry', namespaces):
                    contact = self.parse_contact_xml(ET.tostring(entry, encoding='unicode'))
                    if contact:
                        contacts.append(contact)
                
                return {"contacts": contacts}
            else:
                return {"error": f"Failed to retrieve contacts: {response.status_code} - {response.text}"}
        except Exception as e:
            return {"error": f"Error retrieving contacts: {str(e)}"}
    
    def create_contact(self, contact_data):
        """Create a new shared contact"""
        url = f"https://www.google.com/m8/feeds/contacts/{self.domain}/full"
        headers = self.get_auth_headers()
        
        if not headers:
            return {"error": "Authentication failed"}
        
        xml_data = self.create_contact_xml(contact_data)
        
        try:
            response = requests.post(url, data=xml_data, headers=headers)
            if response.status_code == 201:
                contact = self.parse_contact_xml(response.text)
                return {"success": True, "contact": contact}
            else:
                return {"error": f"Failed to create contact: {response.status_code} - {response.text}"}
        except Exception as e:
            return {"error": f"Error creating contact: {str(e)}"}
    
    def update_contact(self, edit_url, contact_data):
        """Update an existing contact"""
        headers = self.get_auth_headers()
        
        if not headers:
            return {"error": "Authentication failed"}
        
        xml_data = self.create_contact_xml(contact_data)
        
        try:
            response = requests.put(edit_url, data=xml_data, headers=headers)
            if response.status_code == 200:
                contact = self.parse_contact_xml(response.text)
                return {"success": True, "contact": contact}
            else:
                return {"error": f"Failed to update contact: {response.status_code} - {response.text}"}
        except Exception as e:
            return {"error": f"Error updating contact: {str(e)}"}
    
    def delete_contact(self, edit_url):
        """Delete a contact"""
        headers = self.get_auth_headers()
        
        if not headers:
            return {"error": "Authentication failed"}
        
        try:
            response = requests.delete(edit_url, headers=headers)
            if response.status_code == 200:
                return {"success": True}
            else:
                return {"error": f"Failed to delete contact: {response.status_code} - {response.text}"}
        except Exception as e:
            return {"error": f"Error deleting contact: {str(e)}"}
    
    def find_duplicates(self, contacts, threshold=0.8):
        """Find duplicate contacts based on similarity"""
        duplicates = []
        
        for i, contact1 in enumerate(contacts):
            for j, contact2 in enumerate(contacts[i+1:], i+1):
                similarity = self.calculate_similarity(contact1, contact2)
                if similarity >= threshold:
                    duplicates.append({
                        'contact1': contact1,
                        'contact2': contact2,
                        'similarity': similarity
                    })
        
        return duplicates
    
    def calculate_similarity(self, contact1, contact2):
        """Calculate similarity between two contacts"""
        # Compare names
        name1 = f"{contact1.get('first_name', '')} {contact1.get('last_name', '')}".strip().lower()
        name2 = f"{contact2.get('first_name', '')} {contact2.get('last_name', '')}".strip().lower()
        name_similarity = SequenceMatcher(None, name1, name2).ratio()
        
        # Compare primary emails
        email1 = ""
        email2 = ""
        
        if contact1.get('emails'):
            for email in contact1['emails']:
                if email.get('primary'):
                    email1 = email.get('address', '').lower()
                    break
            if not email1 and contact1['emails']:
                email1 = contact1['emails'][0].get('address', '').lower()
        
        if contact2.get('emails'):
            for email in contact2['emails']:
                if email.get('primary'):
                    email2 = email.get('address', '').lower()
                    break
            if not email2 and contact2['emails']:
                email2 = contact2['emails'][0].get('address', '').lower()
        
        email_similarity = 1.0 if email1 and email1 == email2 else 0.0
        
        # Weighted average (email is more important for duplicates)
        return (name_similarity * 0.4 + email_similarity * 0.6)

# Initialize the contacts manager
contacts_manager = GoogleWorkspaceContactsManager(SERVICE_ACCOUNT_FILE, DOMAIN)

# Routes
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/contacts', methods=['GET'])
def get_contacts():
    result = contacts_manager.get_contacts()
    return jsonify(result)

@app.route('/api/contacts', methods=['POST'])
def create_contact():
    contact_data = request.json
    result = contacts_manager.create_contact(contact_data)
    return jsonify(result)

@app.route('/api/contacts/update', methods=['PUT'])
def update_contact():
    data = request.json
    edit_url = data.get('edit_url')
    contact_data = data.get('contact_data')
    
    if not edit_url or not contact_data:
        return jsonify({"error": "Missing edit_url or contact_data"}), 400
    
    result = contacts_manager.update_contact(edit_url, contact_data)
    return jsonify(result)

@app.route('/api/contacts/delete', methods=['DELETE'])
def delete_contact():
    data = request.json
    edit_url = data.get('edit_url')
    
    if not edit_url:
        return jsonify({"error": "Missing edit_url"}), 400
    
    result = contacts_manager.delete_contact(edit_url)
    return jsonify(result)

@app.route('/api/duplicates', methods=['GET'])
def find_duplicates():
    threshold = float(request.args.get('threshold', 0.8))
    contacts_result = contacts_manager.get_contacts()
    
    if 'error' in contacts_result:
        return jsonify(contacts_result)
    
    contacts = contacts_result.get('contacts', [])
    duplicates = contacts_manager.find_duplicates(contacts, threshold)
    
    return jsonify({"duplicates": duplicates})

@app.route('/api/duplicates/remove', methods=['POST'])
def remove_duplicates():
    data = request.json
    duplicate_ids = data.get('duplicate_ids', [])
    
    results = []
    for edit_url in duplicate_ids:
        result = contacts_manager.delete_contact(edit_url)
        results.append({"edit_url": edit_url, "result": result})
    
    return jsonify({"results": results})

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "domain": DOMAIN})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)