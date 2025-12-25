/**
 * Test fixtures for document processing
 */

const TestDocuments = {
    medicalLabReport: {
        id: 'test-doc-001',
        filename: 'lab_results_2024.pdf',
        content: `
            LABORATORY REPORT
            Patient: John Smith
            DOB: 01/15/1980
            Date of Service: 03/15/2024

            Complete Blood Count (CBC):
            WBC: 7.5 x10^9/L (Normal: 4.5-11.0)
            RBC: 4.8 x10^12/L (Normal: 4.5-5.5)
            Hemoglobin: 14.2 g/dL (Normal: 13.5-17.5)
            Hematocrit: 42% (Normal: 38-50%)
            Platelets: 250 x10^9/L (Normal: 150-400)

            Metabolic Panel:
            Glucose: 105 mg/dL (Normal: 70-100) HIGH
            Creatinine: 1.1 mg/dL (Normal: 0.7-1.3)

            Ordering Physician: Dr. Sarah Johnson
            Memorial Hospital Laboratory
        `,
        image_data: null
    },

    financialInvoice: {
        id: 'test-doc-002',
        filename: 'invoice_12345.pdf',
        content: `
            INVOICE #12345

            From: ABC Services LLC
            To: XYZ Corporation

            Date: March 20, 2024
            Due Date: April 20, 2024

            Description: Consulting Services - Q1 2024
            Amount: $5,000.00

            Tax (8%): $400.00
            Total Due: $5,400.00

            Payment Terms: Net 30
        `,
        image_data: null
    },

    generalCorrespondence: {
        id: 'test-doc-003',
        filename: 'letter.pdf',
        content: `
            Dear Mr. Johnson,

            Thank you for your inquiry regarding our services.
            We would be happy to schedule a meeting to discuss
            your requirements in more detail.

            Please let us know your availability.

            Best regards,
            Jane Smith
            Customer Service Manager
        `,
        image_data: null
    }
};

/**
 * Create a base64 test image (1x1 red PNG)
 */
function createTestImageBase64() {
    // Minimal valid PNG (1x1 red pixel)
    const pngBytes = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT chunk
        0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
        0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x18, 0xDD,
        0x8D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, // IEND chunk
        0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ]);
    return pngBytes.toString('base64');
}

module.exports = {
    TestDocuments,
    createTestImageBase64
};