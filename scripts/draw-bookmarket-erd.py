from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUTPUT = Path('exports/BookMarket-ERD-da-sua.png')
im = Image.new('RGB', (2600, 1550), 'white')
d = ImageDraw.Draw(im)
font = 'C:/Windows/Fonts/arial.ttf'
bold = 'C:/Windows/Fonts/arialbd.ttf'
T = ImageFont.truetype(bold, 62)
H = ImageFont.truetype(bold, 37)
E = ImageFont.truetype(bold, 29)
F = ImageFont.truetype(font, 23)
R = ImageFont.truetype(bold, 26)
N = ImageFont.truetype(font, 25)

d.text((65, 34), 'ERD BOOKMARKET – QUAN HỆ DỮ LIỆU', font=T, fill='#174d38')
d.text((68, 115), 'Đối chiếu model MongoDB · FK là trường tham chiếu · 0..N và 0..1 là quan hệ tùy chọn', font=N, fill='#53665a')

groups = [
    ('CATALOG & GIAN HÀNG', '#2c704f', '#edf5ef', 65, [
        ('Category', '_id', '1 : 0..N', 'Book', 'categoryId'),
        ('Author', '_id', 'N : N', 'Book', 'authorIds[]'),
        ('Book', '_id', '1 : 0..N', 'Edition', 'bookId'),
        ('Publisher', '_id', '1 : 0..N', 'Edition', 'publisherId?'),
        ('Edition', '_id', '1 : 0..N', 'Listing', 'editionId'),
        ('User', '_id', '1 : 0..1', 'Shop', 'ownerId'),
        ('User', '_id', '1 : 0..N', 'Listing', 'sellerId'),
        ('Shop', '_id', '1 : 0..N', 'Listing', 'shopId?'),
    ]),
    ('ĐƠN HÀNG & THANH TOÁN', '#ad603b', '#fff2e9', 910, [
        ('User', '_id', '1 : 0..N', 'Order', 'buyerId'),
        ('Order', '_id', '1 : 1..N', 'SubOrder', 'orderId'),
        ('SubOrder', '_id', '1 : 0..N', 'Notification', 'subOrderId'),
        ('User', '_id', '1 : 0..N', 'DigitalOrder', 'buyerId'),
        ('DigitalOrder', '_id', '1 : 0..N', 'EbookAccess', 'digitalOrderId'),
        ('DigitalOrder', '_id', '1 : 0..N', 'BankTransaction', 'orderId?'),
        ('User', '_id', '1 : 0..N', 'Voucher', 'buyerId'),
        ('User', '_id', '1 : 0..N', 'Voucher', 'sellerId'),
        ('Voucher', '_id', '0..1 : 0..1', 'Order', 'voucherId?'),
        ('Voucher', '_id', '0..1 : 0..1', 'DigitalOrder', 'voucherId?'),
    ]),
    ('TƯƠNG TÁC', '#7157a4', '#f2eff9', 1755, [
        ('User', '_id', '1 : 0..N', 'Conversation', 'buyerId'),
        ('User', '_id', '1 : 0..N', 'Conversation', 'sellerId'),
        ('Conversation', '_id', '1 : 0..N', 'Message', 'conversationId'),
        ('User', '_id', '1 : 0..N', 'Message', 'senderId'),
        ('User', '_id', '1 : 0..N', 'Message', 'recipientId'),
        ('User', '_id', '1 : 0..N', 'Review', 'buyerId'),
        ('Listing', '_id: String', '1 : 0..N', 'Review', 'listingId'),
        ('SubOrder', '_id', '1 : 0..N', 'Review', 'subOrderId'),
    ]),
]

for heading, ink, pale, x, relations in groups:
    d.rounded_rectangle((x,210,x+780,1360),radius=24,fill='white',outline=ink,width=4)
    d.rounded_rectangle((x,210,x+780,295),radius=24,fill=ink)
    d.rectangle((x,250,x+780,295),fill=ink)
    d.text((x+27,232),heading,font=H,fill='white')
    for i,(left,left_field,card,right,right_field) in enumerate(relations):
        y=317+i*98
        d.rounded_rectangle((x+20,y,x+267,y+78),radius=13,fill=pale,outline=ink,width=2)
        d.rounded_rectangle((x+513,y,x+760,y+78),radius=13,fill=pale,outline=ink,width=2)
        d.text((x+31,y+8),left,font=E,fill=ink)
        d.text((x+31,y+45),left_field,font=F,fill='#46594e')
        d.text((x+524,y+8),right,font=E,fill=ink)
        d.text((x+524,y+45),right_field,font=F,fill='#46594e')
        d.line((x+274,y+39,x+506,y+39),fill=ink,width=3)
        tw=d.textbbox((0,0),card,font=R)[2]
        d.rounded_rectangle((x+390-tw//2-10,y+17,x+390+tw//2+10,y+62),radius=8,fill='white')
        d.text((x+390-tw//2,y+23),card,font=R,fill=ink)

d.text((72,1403),'Voucher gắn với một người mua và chỉ được dùng cho tối đa một đơn giấy hoặc một đơn ebook.',font=N,fill='#344c3d')
d.text((72,1444),'BankTransaction lưu giao dịch cần đối soát; không đại diện cho toàn bộ thanh toán thành công.',font=N,fill='#344c3d')
d.text((72,1485),'Listing._id là String; phần lớn khóa _id còn lại là ObjectId. Shop của Listing có thể không có.',font=N,fill='#344c3d')
OUTPUT.parent.mkdir(parents=True,exist_ok=True)
im.save(OUTPUT)
print(OUTPUT)
