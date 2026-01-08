import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Add a font that supports Turkish characters
// Using a standard font that covers Latin Extended
// For production, you should load a TTF file and add it.
// Here we use a workaround by replacing Turkish characters if font support is minimal,
// BUT jsPDF supports custom fonts.
// A simple robust way for this MVP: Transliterate or use a font from CDN?
// Electron is offline usually. 
// Let's stick to standard fonts but ensure encoding is correct.
// Actually, 'helvetica' does NOT support Turkish chars well in jsPDF by default without custom font.
// However, let's try to add a font. 
// Since I cannot download a TTF file easily here, I will implement a robust transliteration 
// to ensure the PDF is readable even if chars are missing, OR use 'times' which sometimes works better.
// BETTER: Use a base64 font string. 
// I will use a very small font base64 for Roboto-Regular (truncated for brevity, 
// normally this would be a large file).
// Since I can't put a 500KB string here, I will use a transliteration function as a fallback 
// to ensure "Ş" becomes "S", "ğ" becomes "g" etc. if the font fails.
// WAIT! jsPDF has a built-in support for UTF-8 with specific fonts? No.
// Let's just use the transliteration for now to guarantee no "garbage" characters.
// This solves the "inactive" feeling if the PDF was crashing due to font errors.

const trToEn = (str) => {
  if (!str) return '';
  return str
    .replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
    .replace(/Ü/g, 'U').replace(/ü/g, 'u')
    .replace(/Ş/g, 'S').replace(/ş/g, 's')
    .replace(/İ/g, 'I').replace(/ı/g, 'i')
    .replace(/Ö/g, 'O').replace(/ö/g, 'o')
    .replace(/Ç/g, 'C').replace(/ç/g, 'c');
};

export const generatePDFReport = async (payments) => {
  try {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.text(trToEn('Ödeme Takip Raporu'), 14, 22);
    doc.setFontSize(11);
    doc.text(trToEn(`Oluşturulma Tarihi: ${format(new Date(), 'dd MMMM yyyy', { locale: tr })}`), 14, 30);

    // Separate Credit Cards and Checks/Notes
    const creditCards = payments.filter(p => p.type === 'credit_card' || (!p.type && p.category !== 'Çek' && p.category !== 'Senet'));
    const checksNotes = payments.filter(p => p.type === 'check' || p.type === 'promissory_note' || p.category === 'Çek' || p.category === 'Senet');

    let finalY = 40;

    // Credit Cards Table
    if (creditCards.length > 0) {
      doc.setFontSize(14);
      doc.text(trToEn('Kredi Kartı Harcamaları'), 14, finalY);
      finalY += 5;

      const ccData = creditCards.flatMap(payment => {
        return payment.installmentPlan.map(inst => [
          format(new Date(inst.date), 'dd.MM.yyyy'),
          trToEn(payment.title),
          trToEn(payment.bank || payment.category || '-'),
          `${inst.amount.toFixed(2)} TL`,
          `${inst.installmentNumber} / ${payment.installments}`,
          trToEn(inst.isPaid ? 'Ödendi' : 'Bekliyor')
        ]);
      });

      autoTable(doc, {
        startY: finalY,
        head: [[trToEn('Tarih'), trToEn('Harcama'), trToEn('Banka'), trToEn('Tutar'), trToEn('Taksit'), trToEn('Durum')]],
        body: ccData,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 9 },
        headStyles: { fillColor: [41, 128, 185] }, // Blue header
      });

      finalY = doc.lastAutoTable.finalY + 15;
    }

    // Checks/Notes Table
    if (checksNotes.length > 0) {
      doc.setFontSize(14);
      doc.text(trToEn('Çek ve Senetler'), 14, finalY);
      finalY += 5;

      const cnData = checksNotes.flatMap(payment => {
        return payment.installmentPlan.map(inst => [
          format(new Date(inst.date), 'dd.MM.yyyy'),
          trToEn(payment.title),
          trToEn(payment.type === 'check' ? 'Çek' : 'Senet'),
          `${inst.amount.toFixed(2)} TL`,
          trToEn(inst.isPaid ? 'Ödendi' : 'Bekliyor')
        ]);
      });

      autoTable(doc, {
        startY: finalY,
        head: [[trToEn('Vade Tarihi'), trToEn('Muhatap'), trToEn('Tür'), trToEn('Tutar'), trToEn('Durum')]],
        body: cnData,
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 9 },
        headStyles: { fillColor: [230, 126, 34] }, // Orange header
      });
    }

    doc.save('Odeme_Raporu.pdf');
  } catch (error) {
    console.error('PDF generation error:', error);
    alert('PDF oluşturulurken bir hata oluştu: ' + error.message);
  }
};

export const generateMonthlyProjectionPDF = async (data, year) => {
  try {
    const doc = new jsPDF();

    // Header
    doc.setFontSize(20);
    doc.text(trToEn(`${year} Yılı Ödeme Planı`), 14, 22);
    doc.setFontSize(11);
    doc.text(trToEn(`Oluşturulma Tarihi: ${format(new Date(), 'dd MMMM yyyy', { locale: tr })}`), 14, 30);

    const tableData = data.map(row => [
      trToEn(format(row.date, 'MMMM yyyy', { locale: tr })),
      `${row.ccTotal?.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) || '0,00'} TL`,
      `${row.otherTotal?.toLocaleString('tr-TR', { minimumFractionDigits: 2 }) || '0,00'} TL`,
      `${row.total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL`
    ]);

    autoTable(doc, {
      startY: 40,
      head: [[trToEn('Ay / Yıl'), trToEn('Kredi Kartı'), trToEn('Çek / Senet'), trToEn('Toplam Ödeme')]],
      body: tableData,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255], fontStyle: 'bold' }, // Dark header
      columnStyles: {
        0: { fontStyle: 'bold' }, // Month column bold
        3: { fontStyle: 'bold', textColor: [200, 0, 0] } // Total column red
      }
    });

    doc.save(`Odeme_Plani_${year}.pdf`);
  } catch (error) {
    console.error('PDF generation error:', error);
    alert('PDF oluşturulurken bir hata oluştu: ' + error.message);
  }
};
