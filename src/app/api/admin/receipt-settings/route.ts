import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET – Mevcut fiş ayarlarını getir (yoksa varsayılan oluştur)
export async function GET() {
  try {
    let settings = await db.receiptSettings.findFirst({});

    if (!settings) {
      // Varsayılan ayarlarla oluştur
      settings = await db.receiptSettings.create({
        data: {
          businessName: 'GUSTO RESTORAN',
          addressLine1: '',
          addressLine2: '',
          phone: '',
          taxNo: '',
          footerLine1: 'BİZİ TERCİH ETTİĞİNİZ İÇİN',
          footerLine2: 'TEŞEKKÜR EDERİZ.',
          footerLine3: 'GUSTOPOS RESTORAN YAZILIMI',
          showWaiterName: true,
          showDateTime: true,
          showOrderNote: false,
          autoPrintKitchen: true,
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Fiş Ayarları GET Hatası:', err);
    return NextResponse.json(
      { error: err.message || 'Fiş ayarları yüklenemedi.' },
      { status: 500 }
    );
  }
}

// POST – Fiş ayarlarını güncelle
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      businessName,
      addressLine1,
      addressLine2,
      phone,
      taxNo,
      footerLine1,
      footerLine2,
      footerLine3,
      showWaiterName,
      showDateTime,
      showOrderNote,
      receiptPrinterId,
      autoPrintKitchen,
    } = body;

    // Mevcut ayarları bul veya oluştur
    let settings = await db.receiptSettings.findFirst({});

    if (settings) {
      settings = await db.receiptSettings.update({
        where: { id: settings.id },
        data: {
          businessName: businessName ?? settings.businessName,
          addressLine1: addressLine1 ?? settings.addressLine1,
          addressLine2: addressLine2 ?? settings.addressLine2,
          phone: phone ?? settings.phone,
          taxNo: taxNo ?? settings.taxNo,
          footerLine1: footerLine1 ?? settings.footerLine1,
          footerLine2: footerLine2 ?? settings.footerLine2,
          footerLine3: footerLine3 ?? settings.footerLine3,
          showWaiterName: showWaiterName !== undefined ? showWaiterName : settings.showWaiterName,
          showDateTime: showDateTime !== undefined ? showDateTime : settings.showDateTime,
          showOrderNote: showOrderNote !== undefined ? showOrderNote : settings.showOrderNote,
          receiptPrinterId: receiptPrinterId !== undefined ? receiptPrinterId : settings.receiptPrinterId,
          autoPrintKitchen: autoPrintKitchen !== undefined ? autoPrintKitchen : settings.autoPrintKitchen,
        },
      });
    } else {
      settings = await db.receiptSettings.create({
        data: {
          businessName: businessName || 'GUSTO RESTORAN',
          addressLine1: addressLine1 || '',
          addressLine2: addressLine2 || '',
          phone: phone || '',
          taxNo: taxNo || '',
          footerLine1: footerLine1 || 'BİZİ TERCİH ETTİĞİNİZ İÇİN',
          footerLine2: footerLine2 || 'TEŞEKKÜR EDERİZ.',
          footerLine3: footerLine3 || 'GUSTOPOS RESTORAN YAZILIMI',
          showWaiterName: showWaiterName ?? true,
          showDateTime: showDateTime ?? true,
          showOrderNote: showOrderNote ?? false,
          receiptPrinterId: receiptPrinterId || null,
          autoPrintKitchen: autoPrintKitchen ?? true,
        },
      });
    }

    return NextResponse.json({ success: true, settings });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Fiş Ayarları POST Hatası:', err);
    return NextResponse.json(
      { error: err.message || 'Fiş ayarları kaydedilemedi.' },
      { status: 500 }
    );
  }
}
