const express = require('express');
const PDFDocument = require('pdfkit');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();

app.use(express.json({limit : '10mb'}));
app.use(express.urlencoded({extended:true}));

const corsOptions = {
     origin: 'http://localhost:4200',
     methods: 'POST',
     allowedHeaders: ['Content-Type', 'Authorization'],
     credentials: true,
     optionsSuccessStatus: 204
}

app.use(cors(corsOptions));

app.post('/api/user', async (req,res)=>{
     try {
          console.log("Triggered!")
          const userData = req.body;

          if (!userData || Object.keys(userData).length === 0) {
               return res.status(400).json({ error: 'No user data provided' });
          }

          const requiredFields = ['fullName', 'email', 'phone', 'dob', 'gender', 'address1', 'city', 'state', 'country', 'zipCode', 'age'];
          const missingFields = requiredFields.filter(field => !userData[field]);

          if (missingFields.length > 0) {
               return res.status(400).json({
                    error: 'Missing required fields',
                    missingFields
               });
          }

          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(userData.email)) {
               return res.status(400).json({ error: 'Invalid email format' });
          }

          if (!/^\d{10}$/.test(userData.phone)) {
               return res.status(400).json({ error: 'Phone number must be 10 digits' });
          }

          if (!/^\d{4}-\d{2}-\d{2}$/.test(userData.dob)) {
               return res.status(400).json({ error: 'Invalid date format (YYYY-MM-DD required)' });
          }

          const userId = Date.now().toString();

          let signatureInfo = null;
          if (userData.signature) {
               try {
                    signatureInfo = saveSignature(userData.signature, userId);
               } catch (err) {
                    console.error('Error saving signature:', err);
                    return res.status(400).json({ error: 'Invalid signature image data' });
               }
          }

          const pdfBuffer = await generatePDF(userData, signatureInfo?.filepath);

          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename=user_${userId}.pdf`);

          res.send(pdfBuffer);

          if (signatureInfo?.filepath) {
               fs.unlink(signatureInfo.filepath, (err) => {
                    if (err) console.error('Error cleaning up signature file:', err);
               });
          }

     } catch (error) {
          console.error('Error processing request:', error);
          res.status(500).json({ error: 'Internal server error' });
     }

})

app.listen(3000, ()=>{
     console.log('Server running on http://localhost:3000');
})

function saveSignature(base64Data, userId) {
     const matches = base64Data.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
     if (!matches || matches.length !== 3) {
          throw new Error('Invalid base64 image data');
     }

     const extension = matches[1];
     const data = matches[2];
     const buffer = Buffer.from(data, 'base64');
     const filename = `signature_${userId}_${Date.now()}.${extension}`;
     const filepath = path.join(__dirname, 'signatures', filename);

     if (!fs.existsSync(path.join(__dirname, 'signatures'))) {
          fs.mkdirSync(path.join(__dirname, 'signatures'));
     }

     fs.writeFileSync(filepath, buffer);
     return { filename, filepath };
}

function generatePDF(userData, signaturePath) {
     return new Promise((resolve, reject) => {
          try {
               const doc = new PDFDocument();
               const buffers = [];

               doc.on('data', buffers.push.bind(buffers));
               doc.on('end', () => {
                    const pdfData = Buffer.concat(buffers);
                    resolve(pdfData);
               });

               doc.fontSize(20).text('User Registration Details', { align: 'center' });
               doc.moveDown();

               doc.fontSize(16).text('Personal Information:', { underline: true });
               doc.fontSize(12)
                    .text(`Full Name: ${userData.fullName}`)
                    .text(`Age: ${userData.age}`)
                    .text(`Email: ${userData.email}`)
                    .text(`Phone: ${userData.phone}`)
                    .text(`Date of Birth: ${userData.dob}`)
                    .text(`Gender: ${userData.gender}`);

               if (userData.occupation) {
                    doc.text(`Occupation: ${userData.occupation}`);
               }
               if (userData.income) {
                    doc.text(`Income: ${userData.income}`);
               }

               doc.moveDown();

               doc.fontSize(16).text('Address:', { underline: true });
               doc.fontSize(12)
                    .text(`Address Line 1: ${userData.address1}`);

               if (userData.address2) {
                    doc.text(`Address Line 2: ${userData.address2}`);
               }

               doc.text(`City: ${userData.city}`)
                    .text(`State: ${userData.state}`)
                    .text(`Country: ${userData.country}`)
                    .text(`ZIP Code: ${userData.zipCode}`);

               doc.moveDown();

               if (signaturePath) {
                    doc.fontSize(16).text('Signature:', { underline: true });
                    doc.moveDown();

                    doc.image(signaturePath, {
                         fit: [250, 100],
                         align: 'center'
                    });
               }

               doc.end();
          } catch (err) {
               reject(err);
          }
     });
}