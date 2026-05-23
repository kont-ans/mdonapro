#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
إنستا-مينا - بوت تيليجرام الإداري
Insta-Mina Telegram Admin Bot
Bot Token: 8660886449:AAH2jEqJgScCSbv7yXOiRzAUiKz6g96KTH8
Admin Chat ID: 8630643080
"""

import logging
import json
import os
import re
from datetime import datetime
from telegram import (
    Update, InlineKeyboardButton, InlineKeyboardMarkup,
    ReplyKeyboardMarkup, KeyboardButton
)
from telegram.ext import (
    Application, CommandHandler, MessageHandler,
    CallbackQueryHandler, ContextTypes, filters
)

# ═══════════════════════════════════════════════
#  Configuration
# ═══════════════════════════════════════════════
BOT_TOKEN = "8660886449:AAH2jEqJgScCSbv7yXOiRzAUiKz6g96KTH8"
ADMIN_CHAT_ID = 8630643080

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# In-memory store (replace with real DB in production)
USERS = {}
POSTS = {}
REPORTS = {}
STATS = {
    "total_users": 0,
    "total_posts": 0,
    "total_reports": 0,
    "banned_users": 0,
    "verified_users": 0,
}
maintenance_mode = False


def is_admin(chat_id: int) -> bool:
    return chat_id == ADMIN_CHAT_ID


def format_number(n: int) -> str:
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}م"
    if n >= 1_000:
        return f"{n/1_000:.1f}ك"
    return str(n)


def get_main_keyboard():
    keyboard = [
        [KeyboardButton("📊 الإحصائيات"), KeyboardButton("👥 المستخدمون")],
        [KeyboardButton("📸 المنشورات"), KeyboardButton("🚨 البلاغات")],
        [KeyboardButton("⚙️ الإعدادات"), KeyboardButton("📢 إرسال إشعار عام")],
        [KeyboardButton("🔧 وضع الصيانة"), KeyboardButton("📥 تصدير البيانات")],
    ]
    return ReplyKeyboardMarkup(keyboard, resize_keyboard=True)


# ═══════════════════════════════════════════════
#  Command Handlers
# ═══════════════════════════════════════════════

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    chat_id = update.effective_chat.id

    if not is_admin(chat_id):
        await update.message.reply_text(
            "🚫 عذراً، هذا البوت مخصص للإدارة فقط.\n"
            "للوصول إلى التطبيق، افتح إنستا-مينا مباشرة."
        )
        return

    await update.message.reply_text(
        f"🛡️ *مرحباً، {user.first_name}!*\n\n"
        "أنت مسجّل الدخول كمدير لمنصة *إنستا-مينا*.\n\n"
        "استخدم الأزرار أدناه للتنقل بين لوحة التحكم:",
        parse_mode='Markdown',
        reply_markup=get_main_keyboard()
    )


async def help_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update.effective_chat.id):
        return
    await update.message.reply_text(
        "📚 *دليل استخدام البوت الإداري*\n\n"
        "الأوامر المتاحة:\n"
        "/start - تشغيل البوت\n"
        "/stats - الإحصائيات\n"
        "/users - إدارة المستخدمين\n"
        "/posts - إدارة المنشورات\n"
        "/reports - البلاغات المعلقة\n"
        "/ban [id] - حظر مستخدم\n"
        "/unban [id] - فك حظر مستخدم\n"
        "/verify [id] - توثيق حساب\n"
        "/delete_post [id] - حذف منشور\n"
        "/broadcast [رسالة] - إرسال إشعار لجميع المستخدمين\n"
        "/maintenance - تبديل وضع الصيانة\n"
        "/export - تصدير البيانات\n"
        "/search [اسم] - البحث عن مستخدم\n",
        parse_mode='Markdown'
    )


async def stats_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update.effective_chat.id):
        return
    now = datetime.now().strftime("%Y/%m/%d %H:%M")
    text = (
        "📊 *إحصائيات إنستا-مينا*\n"
        f"⏰ آخر تحديث: {now}\n\n"
        f"👥 إجمالي المستخدمين: `{format_number(STATS['total_users'])}`\n"
        f"📸 إجمالي المنشورات: `{format_number(STATS['total_posts'])}`\n"
        f"🚨 البلاغات المعلقة: `{format_number(STATS['total_reports'])}`\n"
        f"🚫 المستخدمون المحظورون: `{format_number(STATS['banned_users'])}`\n"
        f"✅ الحسابات الموثقة: `{format_number(STATS['verified_users'])}`\n\n"
        f"🔧 وضع الصيانة: {'🔴 مفعّل' if maintenance_mode else '🟢 معطّل'}"
    )
    keyboard = [
        [InlineKeyboardButton("🔄 تحديث", callback_data="refresh_stats"),
         InlineKeyboardButton("📥 تصدير", callback_data="export_stats")]
    ]
    await update.message.reply_text(
        text, parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup(keyboard)
    )


async def users_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update.effective_chat.id):
        return
    user_list = list(USERS.values())[:10]
    if not user_list:
        await update.message.reply_text(
            "👥 *قائمة المستخدمين*\n\nلا يوجد مستخدمون حتى الآن.",
            parse_mode='Markdown'
        )
        return
    text = "👥 *آخر المستخدمين المسجلين:*\n\n"
    for u in user_list:
        status = "🚫" if u.get('banned') else "✅" if u.get('verified') else "👤"
        text += f"{status} `{u.get('id', 'N/A')}` - @{u.get('username', 'N/A')}\n"
    keyboard = [
        [InlineKeyboardButton("🔍 بحث مستخدم", callback_data="search_user"),
         InlineKeyboardButton("📋 عرض الكل", callback_data="all_users")]
    ]
    await update.message.reply_text(
        text, parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup(keyboard)
    )


async def reports_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update.effective_chat.id):
        return
    pending = [r for r in REPORTS.values() if not r.get('resolved')]
    if not pending:
        await update.message.reply_text(
            "🚨 *البلاغات*\n\n✅ لا توجد بلاغات معلقة!",
            parse_mode='Markdown'
        )
        return
    text = f"🚨 *البلاغات المعلقة ({len(pending)}):*\n\n"
    for r in pending[:5]:
        text += (
            f"🆔 #{r.get('id','N/A')}\n"
            f"📌 النوع: {r.get('type','N/A')}\n"
            f"📝 السبب: {r.get('reason','N/A')}\n"
            f"─────────────\n"
        )
    await update.message.reply_text(text, parse_mode='Markdown')


async def ban_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update.effective_chat.id):
        return
    args = context.args
    if not args:
        await update.message.reply_text("الاستخدام: /ban [user_id]")
        return
    user_id = args[0]
    if user_id in USERS:
        USERS[user_id]['banned'] = True
        STATS['banned_users'] += 1
        await update.message.reply_text(
            f"🚫 تم حظر المستخدم #{user_id} بنجاح."
        )
    else:
        await update.message.reply_text(f"❌ لم يُعثر على مستخدم بالمعرف #{user_id}")


async def unban_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update.effective_chat.id):
        return
    args = context.args
    if not args:
        await update.message.reply_text("الاستخدام: /unban [user_id]")
        return
    user_id = args[0]
    if user_id in USERS:
        USERS[user_id]['banned'] = False
        STATS['banned_users'] = max(0, STATS['banned_users'] - 1)
        await update.message.reply_text(f"✅ تم فك حظر المستخدم #{user_id}")
    else:
        await update.message.reply_text(f"❌ لم يُعثر على مستخدم بالمعرف #{user_id}")


async def verify_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update.effective_chat.id):
        return
    args = context.args
    if not args:
        await update.message.reply_text("الاستخدام: /verify [user_id]")
        return
    user_id = args[0]
    if user_id in USERS:
        USERS[user_id]['verified'] = True
        STATS['verified_users'] += 1
        await update.message.reply_text(
            f"✅ تم توثيق حساب المستخدم #{user_id} بنجاح."
        )
    else:
        await update.message.reply_text(f"❌ لم يُعثر على مستخدم بالمعرف #{user_id}")


async def delete_post_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update.effective_chat.id):
        return
    args = context.args
    if not args:
        await update.message.reply_text("الاستخدام: /delete_post [post_id]")
        return
    post_id = args[0]
    if post_id in POSTS:
        del POSTS[post_id]
        STATS['total_posts'] = max(0, STATS['total_posts'] - 1)
        await update.message.reply_text(f"🗑️ تم حذف المنشور #{post_id} بنجاح.")
    else:
        await update.message.reply_text(f"❌ لم يُعثر على منشور بالمعرف #{post_id}")


async def broadcast_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update.effective_chat.id):
        return
    if not context.args:
        await update.message.reply_text(
            "الاستخدام: /broadcast [رسالتك هنا]\n"
            "مثال: /broadcast تم إضافة ميزة جديدة!"
        )
        return
    message = ' '.join(context.args)
    await update.message.reply_text(
        f"📢 *تم إرسال الإشعار العام:*\n\n`{message}`\n\n"
        f"سيصل هذا الإشعار لجميع مستخدمي المنصة.",
        parse_mode='Markdown'
    )


async def maintenance_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global maintenance_mode
    if not is_admin(update.effective_chat.id):
        return
    maintenance_mode = not maintenance_mode
    status = "🔴 مفعّل" if maintenance_mode else "🟢 معطّل"
    keyboard = [[InlineKeyboardButton(
        "🔄 تبديل وضع الصيانة", callback_data="toggle_maintenance"
    )]]
    await update.message.reply_text(
        f"🔧 *وضع الصيانة:* {status}\n\n"
        f"{'⚠️ المنصة الآن في وضع الصيانة. المستخدمون لا يستطيعون الدخول.' if maintenance_mode else '✅ المنصة تعمل بشكل طبيعي.'}",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup(keyboard)
    )


async def export_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update.effective_chat.id):
        return
    data = {
        "export_date": datetime.now().isoformat(),
        "stats": STATS,
        "users": list(USERS.values()),
        "posts": list(POSTS.values()),
        "reports": list(REPORTS.values()),
    }
    filename = f"instamina_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    with open(filename, 'rb') as f:
        await update.message.reply_document(
            document=f,
            filename=filename,
            caption=f"📥 تصدير بيانات إنستا-مينا\n🗓️ {datetime.now().strftime('%Y/%m/%d %H:%M')}"
        )
    os.remove(filename)


async def search_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update.effective_chat.id):
        return
    if not context.args:
        await update.message.reply_text("الاستخدام: /search [اسم المستخدم]")
        return
    query = ' '.join(context.args).lower()
    results = [u for u in USERS.values() if query in u.get('username', '').lower()]
    if not results:
        await update.message.reply_text(f"🔍 لا نتائج لـ '{query}'")
        return
    text = f"🔍 *نتائج البحث عن '{query}':*\n\n"
    for u in results[:5]:
        status = "🚫" if u.get('banned') else "✅" if u.get('verified') else "👤"
        text += f"{status} #{u.get('id','N/A')} - @{u.get('username','N/A')} ({u.get('fullName','')})\n"
    await update.message.reply_text(text, parse_mode='Markdown')


# ═══════════════════════════════════════════════
#  Message Handler (Keyboard buttons)
# ═══════════════════════════════════════════════

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if not is_admin(update.effective_chat.id):
        return
    text = update.message.text

    if text == "📊 الإحصائيات":
        await stats_cmd(update, context)
    elif text == "👥 المستخدمون":
        await users_cmd(update, context)
    elif text == "📸 المنشورات":
        await posts_menu(update, context)
    elif text == "🚨 البلاغات":
        await reports_cmd(update, context)
    elif text == "⚙️ الإعدادات":
        await settings_menu(update, context)
    elif text == "📢 إرسال إشعار عام":
        await update.message.reply_text(
            "📢 استخدم الأمر:\n`/broadcast رسالتك هنا`",
            parse_mode='Markdown'
        )
    elif text == "🔧 وضع الصيانة":
        await maintenance_cmd(update, context)
    elif text == "📥 تصدير البيانات":
        await export_cmd(update, context)
    else:
        await update.message.reply_text(
            "استخدم /help لعرض الأوامر المتاحة.",
            reply_markup=get_main_keyboard()
        )


async def posts_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    post_list = list(POSTS.values())[:10]
    if not post_list:
        await update.message.reply_text(
            "📸 *المنشورات*\n\nلا توجد منشورات حتى الآن.",
            parse_mode='Markdown'
        )
        return
    text = f"📸 *آخر {len(post_list)} منشورات:*\n\n"
    for p in post_list:
        text += f"🆔 #{p.get('id','N/A')} | 👤 @{p.get('username','N/A')} | ❤️ {p.get('likes',0)}\n"
    await update.message.reply_text(text, parse_mode='Markdown')


async def settings_menu(update: Update, context: ContextTypes.DEFAULT_TYPE):
    keyboard = [
        [InlineKeyboardButton("🔧 وضع الصيانة", callback_data="toggle_maintenance")],
        [InlineKeyboardButton("📊 مسح الإحصائيات", callback_data="clear_stats")],
        [InlineKeyboardButton("🔔 إرسال إشعار اختبار", callback_data="test_notif")],
    ]
    await update.message.reply_text(
        "⚙️ *الإعدادات*",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup(keyboard)
    )


# ═══════════════════════════════════════════════
#  Callback Query Handler
# ═══════════════════════════════════════════════

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    global maintenance_mode
    query = update.callback_query
    await query.answer()

    if not is_admin(query.from_user.id):
        await query.edit_message_text("🚫 غير مصرح لك.")
        return

    data = query.data

    if data == "refresh_stats":
        now = datetime.now().strftime("%Y/%m/%d %H:%M")
        text = (
            "📊 *إحصائيات إنستا-مينا* (محدّث)\n"
            f"⏰ {now}\n\n"
            f"👥 المستخدمون: `{format_number(STATS['total_users'])}`\n"
            f"📸 المنشورات: `{format_number(STATS['total_posts'])}`\n"
            f"🚨 البلاغات: `{format_number(STATS['total_reports'])}`\n"
            f"🚫 المحظورون: `{format_number(STATS['banned_users'])}`\n"
            f"✅ الموثقون: `{format_number(STATS['verified_users'])}`\n\n"
            f"🔧 الصيانة: {'🔴 مفعّلة' if maintenance_mode else '🟢 معطّلة'}"
        )
        keyboard = [[
            InlineKeyboardButton("🔄 تحديث", callback_data="refresh_stats"),
            InlineKeyboardButton("📥 تصدير", callback_data="export_stats")
        ]]
        await query.edit_message_text(
            text, parse_mode='Markdown',
            reply_markup=InlineKeyboardMarkup(keyboard)
        )

    elif data == "toggle_maintenance":
        maintenance_mode = not maintenance_mode
        status = "🔴 مفعّل" if maintenance_mode else "🟢 معطّل"
        await query.edit_message_text(
            f"🔧 *وضع الصيانة:* {status}",
            parse_mode='Markdown',
            reply_markup=InlineKeyboardMarkup([[
                InlineKeyboardButton("🔄 تبديل", callback_data="toggle_maintenance")
            ]])
        )

    elif data == "test_notif":
        await query.message.reply_text(
            "🔔 *إشعار اختبار*\nتم إرسال إشعار اختبار بنجاح.",
            parse_mode='Markdown'
        )

    elif data == "clear_stats":
        for k in STATS:
            STATS[k] = 0
        await query.edit_message_text("✅ تم مسح الإحصائيات.")


# ═══════════════════════════════════════════════
#  Webhook endpoint for receiving notifications
# ═══════════════════════════════════════════════

async def notify_new_user(app, user_data: dict):
    """Call this when a new user registers on the platform"""
    STATS['total_users'] += 1
    user_id = str(user_data.get('id', len(USERS) + 1))
    USERS[user_id] = user_data
    await app.bot.send_message(
        chat_id=ADMIN_CHAT_ID,
        text=(
            f"🆕 *مستخدم جديد!*\n\n"
            f"👤 @{user_data.get('username', 'N/A')}\n"
            f"📧 {user_data.get('email', 'N/A')}\n"
            f"🕐 {datetime.now().strftime('%Y/%m/%d %H:%M')}"
        ),
        parse_mode='Markdown'
    )


async def notify_new_report(app, report_data: dict):
    """Call this when a new report is submitted"""
    STATS['total_reports'] += 1
    report_id = str(len(REPORTS) + 1)
    REPORTS[report_id] = {**report_data, 'id': report_id, 'resolved': False}
    keyboard = [[
        InlineKeyboardButton("✅ تم الحل", callback_data=f"resolve_{report_id}"),
        InlineKeyboardButton("🗑️ حذف", callback_data=f"delete_report_{report_id}")
    ]]
    await app.bot.send_message(
        chat_id=ADMIN_CHAT_ID,
        text=(
            f"🚨 *بلاغ جديد!*\n\n"
            f"📌 النوع: {report_data.get('type', 'N/A')}\n"
            f"📝 السبب: {report_data.get('reason', 'N/A')}\n"
            f"🆔 المعرف المُبلَّغ عنه: #{report_data.get('targetId', 'N/A')}\n"
            f"🕐 {datetime.now().strftime('%Y/%m/%d %H:%M')}"
        ),
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup(keyboard)
    )


# ═══════════════════════════════════════════════
#  Main
# ═══════════════════════════════════════════════

def main():
    app = Application.builder().token(BOT_TOKEN).build()

    # Command handlers
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_cmd))
    app.add_handler(CommandHandler("stats", stats_cmd))
    app.add_handler(CommandHandler("users", users_cmd))
    app.add_handler(CommandHandler("reports", reports_cmd))
    app.add_handler(CommandHandler("ban", ban_cmd))
    app.add_handler(CommandHandler("unban", unban_cmd))
    app.add_handler(CommandHandler("verify", verify_cmd))
    app.add_handler(CommandHandler("delete_post", delete_post_cmd))
    app.add_handler(CommandHandler("broadcast", broadcast_cmd))
    app.add_handler(CommandHandler("maintenance", maintenance_cmd))
    app.add_handler(CommandHandler("export", export_cmd))
    app.add_handler(CommandHandler("search", search_cmd))

    # Callback query handler
    app.add_handler(CallbackQueryHandler(handle_callback))

    # Message handler (for keyboard buttons)
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    logger.info("🚀 بوت إنستا-مينا الإداري يعمل الآن...")
    print("=" * 50)
    print("🛡️  إنستا-مينا - بوت تيليجرام الإداري")
    print("=" * 50)
    print(f"🤖 البوت Token: {BOT_TOKEN[:20]}...")
    print(f"👨‍💼 Admin Chat ID: {ADMIN_CHAT_ID}")
    print("✅ البوت يعمل! اضغط Ctrl+C للإيقاف.")
    print("=" * 50)

    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
