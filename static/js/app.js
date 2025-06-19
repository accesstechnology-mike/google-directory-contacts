// Global state
let contacts = [];
let duplicates = [];
let currentEditContact = null;
let csvData = [];

// API base URL
const API_BASE = '/api';

// DOM ready initialization
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Initialize tab navigation
    initializeTabs();
    
    // Initialize form handlers
    initializeForms();
    
    // Initialize search functionality
    initializeSearch();
    
    // Initialize file upload
    initializeFileUpload();
    
    // Initialize similarity threshold slider
    initializeSimilarityThreshold();
    
    // Load initial data
    loadContacts();
    
    // Check health status
    checkHealth();
}

// Tab Navigation
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            // Remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            document.getElementById(tabId + '-tab').classList.add('active');
            
            // Load data based on active tab
            if (tabId === 'contacts') {
                loadContacts();
            } else if (tabId === 'duplicates') {
                loadDuplicatesIfNeeded();
            }
        });
    });
}

// Form Handlers
function initializeForms() {
    // Add contact form
    const addContactForm = document.getElementById('add-contact-form');
    addContactForm.addEventListener('submit', handleAddContact);
    
    // Edit contact form (will be populated dynamically)
    // See editContact function for dynamic form handling
}

// Search functionality
function initializeSearch() {
    const searchInput = document.getElementById('contact-search');
    searchInput.addEventListener('input', debounce(filterContacts, 300));
}

// File upload for bulk import
function initializeFileUpload() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('csv-file');
    
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('drop', handleFileDrop);
    fileInput.addEventListener('change', handleFileSelect);
}

// Similarity threshold slider
function initializeSimilarityThreshold() {
    const slider = document.getElementById('similarity-threshold');
    const valueDisplay = document.getElementById('threshold-value');
    
    slider.addEventListener('input', (e) => {
        const value = Math.round(e.target.value * 100);
        valueDisplay.textContent = value + '%';
    });
}

// API Functions
async function apiCall(endpoint, options = {}) {
    const url = API_BASE + endpoint;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
    };
    
    const config = { ...defaultOptions, ...options };
    
    try {
        showLoading();
        const response = await fetch(url, config);
        const data = await response.json();
        hideLoading();
        
        if (!response.ok) {
            throw new Error(data.error || 'API request failed');
        }
        
        return data;
    } catch (error) {
        hideLoading();
        showNotification('Error: ' + error.message, 'error');
        throw error;
    }
}

async function loadContacts() {
    try {
        const result = await apiCall('/contacts');
        if (result.contacts) {
            contacts = result.contacts;
            renderContacts(contacts);
            updateStats();
        }
    } catch (error) {
        console.error('Failed to load contacts:', error);
    }
}

async function checkHealth() {
    try {
        const result = await apiCall('/health');
        if (result.status === 'healthy') {
            console.log('API is healthy, domain:', result.domain);
        }
    } catch (error) {
        showNotification('API connection failed. Please check your configuration.', 'error');
    }
}

// Contact Management
async function handleAddContact(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const contactData = formDataToObject(formData);
    
    try {
        const result = await apiCall('/contacts', {
            method: 'POST',
            body: JSON.stringify(contactData)
        });
        
        if (result.success) {
            showNotification('Contact created successfully!', 'success');
            event.target.reset();
            loadContacts(); // Refresh the contacts list
            
            // Switch to contacts tab
            document.querySelector('[data-tab="contacts"]').click();
        }
    } catch (error) {
        console.error('Failed to create contact:', error);
    }
}

async function editContact(contact) {
    currentEditContact = contact;
    
    // Populate edit form
    const editForm = document.getElementById('edit-contact-form');
    editForm.innerHTML = generateContactFormHTML(contact);
    
    // Show modal
    showModal('edit-contact-modal');
    
    // Add form submit handler
    editForm.addEventListener('submit', handleEditContact);
}

async function handleEditContact(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const contactData = formDataToObject(formData);
    
    try {
        const result = await apiCall('/contacts/update', {
            method: 'PUT',
            body: JSON.stringify({
                edit_url: currentEditContact.edit_url,
                contact_data: contactData
            })
        });
        
        if (result.success) {
            showNotification('Contact updated successfully!', 'success');
            closeEditModal();
            loadContacts(); // Refresh the contacts list
        }
    } catch (error) {
        console.error('Failed to update contact:', error);
    }
}

async function deleteContact(contact) {
    const confirmed = await showConfirmation(
        `Are you sure you want to delete "${contact.full_name || 'this contact'}"?`
    );
    
    if (!confirmed) return;
    
    try {
        const result = await apiCall('/contacts/delete', {
            method: 'DELETE',
            body: JSON.stringify({ edit_url: contact.edit_url })
        });
        
        if (result.success) {
            showNotification('Contact deleted successfully!', 'success');
            loadContacts(); // Refresh the contacts list
        }
    } catch (error) {
        console.error('Failed to delete contact:', error);
    }
}

// Duplicate Detection
async function findDuplicates() {
    const threshold = document.getElementById('similarity-threshold').value;
    
    try {
        const result = await apiCall(`/duplicates?threshold=${threshold}`);
        if (result.duplicates) {
            duplicates = result.duplicates;
            renderDuplicates(duplicates);
            updateStats();
        }
    } catch (error) {
        console.error('Failed to find duplicates:', error);
    }
}

function loadDuplicatesIfNeeded() {
    if (duplicates.length === 0) {
        findDuplicates();
    }
}

async function removeDuplicate(editUrl) {
    const confirmed = await showConfirmation(
        'Are you sure you want to delete this duplicate contact?'
    );
    
    if (!confirmed) return;
    
    try {
        const result = await apiCall('/duplicates/remove', {
            method: 'POST',
            body: JSON.stringify({ duplicate_ids: [editUrl] })
        });
        
        if (result.results && result.results[0].result.success) {
            showNotification('Duplicate removed successfully!', 'success');
            findDuplicates(); // Refresh duplicates
            loadContacts(); // Refresh contacts
        }
    } catch (error) {
        console.error('Failed to remove duplicate:', error);
    }
}

// Rendering Functions
function renderContacts(contactsToRender) {
    const container = document.getElementById('contacts-grid');
    
    if (contactsToRender.length === 0) {
        container.innerHTML = `
            <div class="text-center" style="grid-column: 1 / -1; padding: 40px;">
                <i class="fas fa-address-book" style="font-size: 3rem; color: #ddd; margin-bottom: 20px;"></i>
                <h3 style="color: #666;">No contacts found</h3>
                <p style="color: #999;">Add your first contact to get started.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = contactsToRender.map(contact => `
        <div class="contact-card">
            <div class="contact-header">
                <div>
                    <div class="contact-name">${contact.full_name || 'Unnamed Contact'}</div>
                </div>
                <div class="contact-actions">
                    <button class="btn btn-icon btn-secondary" onclick="editContact(${JSON.stringify(contact).replace(/"/g, '&quot;')})" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-icon btn-danger" onclick="deleteContact(${JSON.stringify(contact).replace(/"/g, '&quot;')})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="contact-info">
                ${contact.emails && contact.emails.length > 0 ? `
                    <div class="contact-info-item">
                        <i class="fas fa-envelope"></i>
                        <span>${contact.emails[0].address}</span>
                    </div>
                ` : ''}
                ${contact.phones && contact.phones.length > 0 ? `
                    <div class="contact-info-item">
                        <i class="fas fa-phone"></i>
                        <span>${contact.phones[0].number}</span>
                    </div>
                ` : ''}
                ${contact.notes ? `
                    <div class="contact-info-item">
                        <i class="fas fa-sticky-note"></i>
                        <span>${contact.notes}</span>
                    </div>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function renderDuplicates(duplicatesToRender) {
    const container = document.getElementById('duplicates-container');
    
    if (duplicatesToRender.length === 0) {
        container.innerHTML = `
            <div class="text-center" style="padding: 40px;">
                <i class="fas fa-check-circle" style="font-size: 3rem; color: #34a853; margin-bottom: 20px;"></i>
                <h3 style="color: #666;">No duplicates found</h3>
                <p style="color: #999;">Your contacts are looking clean!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = duplicatesToRender.map((duplicate, index) => `
        <div class="duplicate-pair">
            <div class="duplicate-header">
                <h4>Potential Duplicate ${index + 1}</h4>
                <span class="similarity-score">${Math.round(duplicate.similarity * 100)}% similar</span>
            </div>
            <div class="duplicate-contacts">
                <div class="duplicate-contact">
                    <h5>${duplicate.contact1.full_name || 'Unnamed Contact'}</h5>
                    <p><i class="fas fa-envelope"></i> ${duplicate.contact1.emails?.[0]?.address || 'No email'}</p>
                    <p><i class="fas fa-phone"></i> ${duplicate.contact1.phones?.[0]?.number || 'No phone'}</p>
                </div>
                <div class="vs-indicator">VS</div>
                <div class="duplicate-contact">
                    <h5>${duplicate.contact2.full_name || 'Unnamed Contact'}</h5>
                    <p><i class="fas fa-envelope"></i> ${duplicate.contact2.emails?.[0]?.address || 'No email'}</p>
                    <p><i class="fas fa-phone"></i> ${duplicate.contact2.phones?.[0]?.number || 'No phone'}</p>
                </div>
            </div>
            <div class="duplicate-actions">
                <button class="btn btn-danger" onclick="removeDuplicate('${duplicate.contact1.edit_url}')">
                    <i class="fas fa-trash"></i>
                    Remove First
                </button>
                <button class="btn btn-danger" onclick="removeDuplicate('${duplicate.contact2.edit_url}')">
                    <i class="fas fa-trash"></i>
                    Remove Second
                </button>
                <button class="btn btn-secondary" onclick="editContact(${JSON.stringify(duplicate.contact1).replace(/"/g, '&quot;')})">
                    <i class="fas fa-edit"></i>
                    Edit First
                </button>
                <button class="btn btn-secondary" onclick="editContact(${JSON.stringify(duplicate.contact2).replace(/"/g, '&quot;')})">
                    <i class="fas fa-edit"></i>
                    Edit Second
                </button>
            </div>
        </div>
    `).join('');
}

// Search and Filter
function filterContacts() {
    const searchTerm = document.getElementById('contact-search').value.toLowerCase();
    
    if (!searchTerm) {
        renderContacts(contacts);
        return;
    }
    
    const filteredContacts = contacts.filter(contact => {
        const name = (contact.full_name || '').toLowerCase();
        const email = contact.emails?.[0]?.address?.toLowerCase() || '';
        const phone = contact.phones?.[0]?.number || '';
        const notes = (contact.notes || '').toLowerCase();
        
        return name.includes(searchTerm) ||
               email.includes(searchTerm) ||
               phone.includes(searchTerm) ||
               notes.includes(searchTerm);
    });
    
    renderContacts(filteredContacts);
}

// Bulk Import Functions
function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
}

function handleFileDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFileSelect(event) {
    const files = event.target.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFile(file) {
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
        showNotification('Please select a CSV file', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const csvText = e.target.result;
        parseCSV(csvText);
    };
    reader.readAsText(file);
}

function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
        showNotification('CSV file must have at least a header row and one data row', 'error');
        return;
    }
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const requiredHeaders = ['first_name', 'last_name', 'email'];
    
    const missingHeaders = requiredHeaders.filter(req => !headers.includes(req));
    if (missingHeaders.length > 0) {
        showNotification(`Missing required columns: ${missingHeaders.join(', ')}`, 'error');
        return;
    }
    
    csvData = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        const record = {};
        
        headers.forEach((header, index) => {
            record[header] = values[index] || '';
        });
        
        if (record.first_name || record.last_name || record.email) {
            csvData.push(record);
        }
    }
    
    if (csvData.length === 0) {
        showNotification('No valid contact data found in CSV', 'error');
        return;
    }
    
    showImportPreview();
}

function showImportPreview() {
    document.getElementById('upload-area').style.display = 'none';
    document.getElementById('import-preview').style.display = 'block';
    
    const table = document.getElementById('preview-table');
    const headers = Object.keys(csvData[0]);
    
    table.innerHTML = `
        <thead>
            <tr>
                ${headers.map(header => `<th>${header}</th>`).join('')}
            </tr>
        </thead>
        <tbody>
            ${csvData.slice(0, 10).map(record => `
                <tr>
                    ${headers.map(header => `<td>${record[header] || ''}</td>`).join('')}
                </tr>
            `).join('')}
        </tbody>
    `;
    
    if (csvData.length > 10) {
        const tbody = table.querySelector('tbody');
        tbody.innerHTML += `
            <tr>
                <td colspan="${headers.length}" style="text-align: center; font-style: italic; color: #666;">
                    ... and ${csvData.length - 10} more rows
                </td>
            </tr>
        `;
    }
}

function cancelImport() {
    document.getElementById('upload-area').style.display = 'block';
    document.getElementById('import-preview').style.display = 'none';
    document.getElementById('csv-file').value = '';
    csvData = [];
}

async function importContacts() {
    if (csvData.length === 0) {
        showNotification('No data to import', 'error');
        return;
    }
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const record of csvData) {
        try {
            const contactData = {
                first_name: record.first_name || '',
                last_name: record.last_name || '',
                email: record.email || '',
                phone: record.phone || '',
                notes: record.notes || '',
                display_name: record.display_name || `${record.first_name} ${record.last_name}`.trim()
            };
            
            const result = await apiCall('/contacts', {
                method: 'POST',
                body: JSON.stringify(contactData)
            });
            
            if (result.success) {
                successCount++;
            } else {
                errorCount++;
            }
        } catch (error) {
            errorCount++;
            console.error('Failed to import contact:', record, error);
        }
    }
    
    showNotification(
        `Import completed: ${successCount} contacts added, ${errorCount} errors`,
        errorCount === 0 ? 'success' : 'warning'
    );
    
    cancelImport();
    loadContacts();
}

// Utility Functions
function formDataToObject(formData) {
    const obj = {};
    
    for (const [key, value] of formData.entries()) {
        if (key.includes('.')) {
            // Handle nested objects like address.city
            const parts = key.split('.');
            if (!obj[parts[0]]) obj[parts[0]] = {};
            obj[parts[0]][parts[1]] = value;
        } else if (key.endsWith('[]')) {
            // Handle arrays like additional_emails[]
            const arrayKey = key.slice(0, -2);
            if (!obj[arrayKey]) obj[arrayKey] = [];
            if (value) obj[arrayKey].push(value);
        } else {
            obj[key] = value;
        }
    }
    
    return obj;
}

function generateContactFormHTML(contact = {}) {
    return `
        <div class="form-row">
            <div class="form-group">
                <label for="edit_first_name">First Name *</label>
                <input type="text" id="edit_first_name" name="first_name" value="${contact.first_name || ''}" required>
            </div>
            <div class="form-group">
                <label for="edit_last_name">Last Name *</label>
                <input type="text" id="edit_last_name" name="last_name" value="${contact.last_name || ''}" required>
            </div>
        </div>
        <div class="form-row">
            <div class="form-group">
                <label for="edit_email">Email *</label>
                <input type="email" id="edit_email" name="email" value="${contact.emails?.[0]?.address || ''}" required>
            </div>
            <div class="form-group">
                <label for="edit_phone">Phone</label>
                <input type="tel" id="edit_phone" name="phone" value="${contact.phones?.[0]?.number || ''}">
            </div>
        </div>
        <div class="form-group">
            <label for="edit_display_name">Display Name</label>
            <input type="text" id="edit_display_name" name="display_name" value="${contact.emails?.[0]?.displayName || ''}">
        </div>
        <div class="form-group">
            <label for="edit_notes">Notes</label>
            <textarea id="edit_notes" name="notes" rows="3">${contact.notes || ''}</textarea>
        </div>
        <div class="form-actions">
            <button type="submit" class="btn btn-primary">
                <i class="fas fa-save"></i>
                Update Contact
            </button>
            <button type="button" class="btn btn-secondary" onclick="closeEditModal()">
                <i class="fas fa-times"></i>
                Cancel
            </button>
        </div>
    `;
}

function updateStats() {
    document.getElementById('total-contacts').textContent = contacts.length;
    document.getElementById('duplicate-count').textContent = duplicates.length;
}

function refreshContacts() {
    loadContacts();
    showNotification('Contacts refreshed', 'success');
}

// Email field management
function addEmailField() {
    const container = document.getElementById('additional-emails');
    const emailInput = document.createElement('div');
    emailInput.className = 'email-input';
    emailInput.innerHTML = `
        <input type="email" name="additional_emails[]" placeholder="Additional email address">
        <button type="button" class="btn btn-icon" onclick="removeEmailField(this)">
            <i class="fas fa-minus"></i>
        </button>
    `;
    container.appendChild(emailInput);
}

function removeEmailField(button) {
    button.parentElement.remove();
}

// Modal Functions
function showModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeEditModal() {
    document.getElementById('edit-contact-modal').classList.remove('active');
    currentEditContact = null;
}

function closeConfirmModal() {
    document.getElementById('confirm-modal').classList.remove('active');
}

function showConfirmation(message) {
    return new Promise((resolve) => {
        document.getElementById('confirm-message').textContent = message;
        const modal = document.getElementById('confirm-modal');
        const yesBtn = document.getElementById('confirm-yes');
        
        modal.classList.add('active');
        
        function handleResponse(confirmed) {
            modal.classList.remove('active');
            yesBtn.removeEventListener('click', handleYes);
            resolve(confirmed);
        }
        
        function handleYes() {
            handleResponse(true);
        }
        
        yesBtn.addEventListener('click', handleYes);
        
        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                handleResponse(false);
            }
        });
    });
}

// Loading and Notifications
function showLoading() {
    document.getElementById('loading').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loading').classList.add('hidden');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icon = type === 'success' ? 'check-circle' : 
                 type === 'error' ? 'exclamation-circle' :
                 type === 'warning' ? 'exclamation-triangle' : 'info-circle';
    
    notification.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;
    
    document.getElementById('notifications').appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Utility Functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}