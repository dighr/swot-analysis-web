import * as imageDataUri from 'image-data-uri';
import * as Handlebars from 'handlebars';
import * as Util from 'util';
import * as Path from 'path';
import * as Fs from 'fs';
import * as cheerio from 'cheerio';
import * as XLSX from 'xlsx';
import * as Puppeteer from 'puppeteer';
const ReadFile = Util.promisify(Fs.readFile)

export type ReportInfo = {
  //location where ANN files reside
  pythonFolder: string,
  //location where Octave files reside
  octaveFolder: string,
  //location where PDF output should reside
  outputFolder: string,
  //base filename
  filename: string,
  reportDate: string,
  countryName: string,
  projectName: string,
  fieldSiteName: string,
  datasetName: string,
  numSamples: string,
  numOptimize: string,
  confidenceLevel: string,
}

export class AnalysisReport {

  async html(report: ReportInfo) {

    //get base64 for octave images
    const octaveBackcheck = await imageDataUri.encodeFromFile(Path.resolve(report.octaveFolder, report.filename + "_Backcheck.png"));
    const octaveContour = await imageDataUri.encodeFromFile(Path.resolve(report.octaveFolder, report.filename + "_Contour.png"));
    //get the ANN table
    const $ = cheerio.load(Fs.readFileSync(Path.resolve(report.pythonFolder, report.filename + "_Results.html")));
    const pythonReport = `<table class="table center" border="1">${$('.tabular_results').html()}</table>`;
    //get the Excel table from octave output
    var workbook = XLSX.readFile(Path.resolve(report.octaveFolder, report.filename + "_Results.xlsx"));
    const octaveExcelOutputFull = XLSX.utils.sheet_to_html(workbook.Sheets[workbook.SheetNames[0]]);
    const $octave = cheerio.load(octaveExcelOutputFull);
    const octaveExcelOutput = `<table class="table center" border="1">${$octave('table').html()}</table>`;
    //get the FRC images
    const annFRC = await imageDataUri.encodeFromFile(Path.resolve(report.pythonFolder, report.filename + "-frc.jpg"));

    try {
      //prepare report data
      const data = {
        reportDate: report.reportDate,
        countryName: report.countryName,
        projectName: report.projectName,
        fieldSiteName: report.fieldSiteName,
        datasetName: report.datasetName,
        numSamples: report.numSamples,
        numOptimize: report.numOptimize,
        confidenceLevel: report.confidenceLevel,
        octaveBackcheck: octaveBackcheck,
        octaveExcelOutput: octaveExcelOutput,
        octaveContour: octaveContour,
        pythonHtmlReport: pythonReport,
        pythonFRCImage: annFRC
      }

      //inject template into report
      const templatePath = Path.resolve('./static/report-template.html')
      const content = await ReadFile(templatePath, 'utf8')
      const template = Handlebars.compile(content)
      return template(data)
    } catch (error) {
      throw new Error('Cannot create HTML report template.' + error)
    }
  }

  async pdf(report: ReportInfo) {
    const html = await this.html(report);
    //for debugging, save the html file
    //Fs.writeFileSync(Path.resolve(report.folder, report.filename + "-test.html"), html)
    const browser = await Puppeteer.launch()
    const page = await browser.newPage()
    await page.setContent(html)

    await page.emulateMediaType('screen');
    return page.pdf({
      path: Path.resolve(report.outputFolder, report.filename + ".pdf")
    })
  }
}

// for debugging purposes -- run `node report.js` in dist folder. Ensure report-template.html is in the same directory
// new AnalysisReport().pdf({
//   confidenceLevel: 'max',
//   countryName: 'Sudan',
//   datasetName: 'Test 123',
//   fieldSiteName: 'Site 123',
//   filename: 'python6__ssc1__TESTSite__20200125',
//   pythonFolder: 'C:\\source\\swot\\report\\sampledata',
//   octaveFolder: 'C:\\source\\swot\\report\\sampledata',
//   outputFolder: 'C:\\source\\swot\\report\\sampledata',
//   numOptimize: '123',
//   numSamples: '1234',
//   projectName: 'Project ABC',
//   reportDate: 'May 10, 2020'
// })
