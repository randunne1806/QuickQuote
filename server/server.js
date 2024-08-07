const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const xml2js = require('xml2js');
const app = express();
const port = process.env.PORT || 5000;
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://sean:gOBYvLh1jis9P3tL@cluster0.liqxi.mongodb.net/?retryWrites=true&w=majority";
const url = "mongodb+srv://seanrandunne:POxQegQ51Z2VKwpH@cluster0.on1akk8.mongodb.net/?retryWrites=true&w=majority";
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Readable } = require('stream');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'outlook',
  auth: {
      user: 'sean.randunne@hotmail.com',
      pass: 'nipuna'
  }
});

const region = 'us-east-1'; // Replace with your AWS region, e.g., 'us-east-1'

const s3Client = new S3Client({ region });
/*
const pdfFilePath = './12608.pdf'; // Replace with the actual file name

// Assuming you have a sample file object; adjust it as needed
const sampleFile = {
  originalname: '12608.pdf',
  path: pdfFilePath,
};
*/
const client = new MongoClient(url, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

function sendEmail(subject, text) {
  const mailOptions = {
      from: 'sean.randunne@hotmail.com',
      to: 'sean.randunne@amitron.com',
      subject: subject,
      text: text
  };

  transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
          console.error('Error sending email:', error);
      } else {
          console.log('Email sent:', info.response);
      }
  });
}

async function uploadToMongo(document){
  await client.connect();
  const db = client.db('amitron-labs-lake');
  const collection = db.collection("Quote-Generator");
  await db.collection('Quote-Generator').insertOne(document);
  console.log("Form data successfully uploaded to MongoDB");
}

async function uploadToNewMongo(document){
  await client.connect();
  const db = client.db('amitron-labs-lake');
  const collection = db.collection("QuickQuote");
  await db.collection('QuickQuote').insertOne(document);
  console.log("Quote data successfully uploaded to MongoDB");
}

async function uploadToS3(file) {
  return new Promise(async (resolve, reject) => {
    // Define the S3 bucket name and key (file path within the bucket)
    const bucketName = 'quote-generator123';
    const key = `uploads/${file.originalname}`;

    // Read the file content as a stream
    const fileStream = fs.createReadStream(file.path);

    // Set up S3 upload parameters
    const params = {
      Bucket: bucketName,
      Key: key,
      Body: fileStream,
    };

    try {
      // Upload the file to S3
      const data = await s3Client.send(new PutObjectCommand(params));

      // File uploaded successfully to S3
      console.log('File uploaded to S3:', data.Location);

      // Remove the local file after uploading to S3
      fs.unlinkSync(file.path);

      resolve(data);
    } catch (err) {
      console.error('Error uploading to S3:', err);
      reject(err);
    }
  });
}

// Configure multer to handle file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

app.use(express.json());
app.use(cors());
let quoteNumber;
// Serve static files from the "uploads" directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.post('/userdata', (req, res) => {
  const body = req.body;
  console.log(body);
  uploadToNewMongo(body);
});

app.post('/upload', upload.single('file'), (req, res) => {
  // Handle file upload
  const { body, file } = req;

  const sourceFilePat = file.path; // multer automatically saves the file to this path
  const destinationFilePat = path.join(__dirname, 'uploads', file.originalname);
  
  fs.rename(sourceFilePat, destinationFilePat, (err) => {
    if (err) {
      console.error('Error moving the file to the uploads folder:', err);
      //res.status(500).json({ error: 'Failed to save the file' });
      return;
    }

    console.log('File saved to uploads folder:', destinationFilePat);

    // Now, pass the saved file to the uploadToS3 function
    uploadToS3(file)
      .then((uploadResult) => {
        // Handle successful S3 upload if needed
        console.log('S3 upload result:', uploadResult);
        //res.json({ message: 'File uploaded successfully' });
      })
      .catch((uploadError) => {
        // Handle S3 upload error
        console.error('Error uploading to S3:', uploadError);
        //res.status(500).json({ error: 'Failed to upload to S3' });
      });
    });
  console.log('Received form data:', body);
  console.log('Uploaded file:', file);
  uploadToMongo(body);
  quoteNumber = file["filename"].slice(0, -4);
  // Sample XML data matching the structure you provided
  const sampleXMLData = `<Xjd>
    <Archive>
      <ArchiveHeader name="` + file["originalname"] + `" />
    </Archive>
    <Parameters>
      <Parameter name="I8_LegendColor">` + body["legendColor"]+ `</Parameter>
      <Parameter name="I8_SolderMaskColor">` + body["soldermaskColor"] + `</Parameter>
      <Parameter name="I8_Thickness">` + body["thickness"] + `</Parameter>
      <Parameter name="I8_SurfaceFinish">` + body["finish"] + `</Parameter>
    </Parameters>
    <CustomParameters>
      <Parameter name="I8_Contact">` + body["contact"] + `</Parameter>
      <Parameter name="I8_Phone">` + body["phone"] + `</Parameter>
    </CustomParameters>
  </Xjd>`;

  // Parse the XML data into a JavaScript object
  xml2js.parseString(sampleXMLData, (err, result) => {
    if (err) {
      console.error('Error parsing XML:', err);
      return;
    }

    // Convert the JavaScript object back to XML
    const builder = new xml2js.Builder();
    const xmlData = builder.buildObject(result);

    // Define the file path where you want to save the XML file
    //const filePath = 'output/' + file["filename"].slice(0, -4) + ".xml";
    const filePath = '//UCAMCO01/Ucamco/I8Webintegr8tion/' + file["filename"].slice(0, -4) + ".xjd";
    // Write the XML data to the file
    fs.writeFile(filePath, xmlData, (err) => {
        if (err) {
          console.error('Error writing to XML file:', err);
        } else {
          console.log('Data has been written to', filePath);
        }
      });
    });

    const sourceFilePath = path.join(__dirname, 'uploads', file["filename"]); // Adjust the source file path as needed
    const destinationFilePath = path.join('//UCAMCO01/Ucamco/I8Webintegr8tion/', file["filename"]); // Adjust the destination file path as needed

    fs.copyFile(sourceFilePath, destinationFilePath, (err) => {
      if (err) {
        console.error('Error copying the file:', err);
      } else {
        // File has been copied successfully, now you can remove it from the source
        fs.unlink(sourceFilePath, (err) => {
          if (err) {
            console.error('Error removing the source file:', err);
          } else {
            console.log('File moved successfully');
          }
        });
      }
    });  
    
  res.json({ message: 'File uploaded successfully' });
});


let matchingFileName;
let summary = [];

const checkDirectoryForFile = () => {
  const directoryPath = '//ucamco01/I8/Output/PDFandXML'; // Replace with your directory path
  const searchString = quoteNumber; // Replace with the specific string you're looking for

  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      console.error('Error reading directory:', err);
      return;
    }

    // Find the first file with the specific string
    const matchingFiles = files.filter(file => file.includes(searchString));

    if (matchingFiles.length > 0) {
      let newestFile = matchingFiles[0]; // Assume the first file is the newest initially
      let newestCreationTime = fs.statSync(path.join(directoryPath, newestFile)).ctime;

      // Iterate through matching files to find the newest one
      for (let i = 1; i < matchingFiles.length; i++) {
        const currentFile = matchingFiles[i];
        const currentCreationTime = fs.statSync(path.join(directoryPath, currentFile)).ctime;

        if (currentCreationTime > newestCreationTime) {
          newestFile = currentFile;
          newestCreationTime = currentCreationTime;
        }
      }
      matchingFileName = newestFile;
      const xmlData = fs.readFileSync('//ucamco01/I8/Output/PDFandXML/' + matchingFileName.substring(0,5) + '.xml', 'utf-8');

      // Parse the XML data
      xml2js.parseString(xmlData, (err, result) => {
          if (err) {
              console.error('Error parsing XML:', err);
              return;
          }
      
          try {
              const summaryElement = result.QED.Summary[0];
              const summaryParameters = summaryElement.SummaryParameter;
      
              // Looping through each SummaryParameter object
              summaryParameters.forEach((parameter, index) => {
                  const paramName = parameter['$'].name;
                  const paramValue = parameter._;
      
                  //console.log(`Summary Parameter ${index + 1}:`);
                  //console.log(`  Name: ${paramName}`);
                  //console.log(`  Value: ${paramValue}`);
                  // Add more specific properties if needed
                  //console.log('------------------------');
                  if(index == 0){
                    summary.push(paramValue);
                  }
                  if(index == 1){
                    summary.push(paramValue);
                  }
                  if(index == 2){
                    summary.push(paramValue);
                  }
                  if(index == 3){
                    summary.push(paramValue);
                  }
                  if(index == 27){
                    summary.push(paramValue);
                  }
                  if(index == 18){
                    summary.push(paramValue);
                  }
                  if(index == 19){
                    summary.push(paramValue);
                  }
                  if(index == 10){
                    summary.push(paramValue);
                  }
                  if(index == 12){
                    summary.push(paramValue);
                  }
                  if(index == 17){
                    summary.push(paramValue);
                  }
                  if(index == 16){
                    summary.push(paramValue);
                  }
                  if(index == 28){
                    summary.push(paramValue);
                  }
                  if(index == 4){
                    summary.push(paramValue);
                  }
                  if(index == 6){
                    summary.push(paramValue);
                  }
              });
              console.log(summary);
          } catch (error) {
              console.error('Error accessing XML data:', error);
          }
      });
      sendEmail("Amitron Quoting: Cart", "http://localhost:3000/cartSummary");
      console.log('Matching file found:', matchingFileName);

    } else {
      console.log('No matching file found.');
    }
  });
};

// Set up interval to check the directory every minute (60,000 milliseconds)
const interval = 60 * 1000;
setInterval(checkDirectoryForFile, interval);

// ... (rest of your code)

app.get('/pdf', (req, res) => {
  const pdfFilePath = path.join(__dirname, '12608.pdf');
  //res.sendFile('I:/Output/PDFandXML/' + matchingFileName);
  res.sendFile('//ucamco01/I8/Work/' + matchingFileName.substring(0,5) + '/work/.png/i8_bottomview.png');
});

app.get('/png', (req, res) => {
  const pdfFilePath = path.join(__dirname, '12608.pdf');
  //res.sendFile('I:/Output/PDFandXML/' + matchingFileName);
  res.sendFile('//ucamco01/I8/Work/' + matchingFileName.substring(0,5) + '/work/.png/job.png');
});

app.get('/summary', (req, res) => {
  const pdfFilePath = path.join(__dirname, '12608.pdf');
  //res.sendFile('I:/Output/PDFandXML/' + matchingFileName);
  if(summary[6] == '0'){
    summary[6] = 'No';
  }
  if(summary[7] == '0'){
    summary[7] = 'No';
  }
  if(summary[4] == '4'){
    summary[4] = "Both";
  }
  if(summary[5] == '1'){
    summary[5] = "Top Only";
  }
  let formattedOutput = [summary[0] + ' in x ' + summary[1] + ' in', summary[3] + ' mil', summary[2], summary[12], summary[4], summary[10], summary[5], summary[11], ' ', summary[6], summary[7], ' ', summary[9], ' ', summary[8] + ' Holes/inch2', ' ', ' ', ' ', ' ', summary[13], ' ']
  res.json(formattedOutput);
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
