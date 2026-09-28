require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionsBitField,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");

const CONFIG = {
  token: process.env.TOKEN,
  clientId: process.env.CLIENT_ID,

  commandRoleId: process.env.APPLICATION_COMMAND_ROLE_ID,

  mainGuildId: process.env.MAIN_GUILD_ID,

  logGuildId: process.env.LOG_GUILD_ID,
  logChannelId: process.env.LOG_CHANNEL_ID,

  acceptedRoleId: process.env.ACCEPTED_ROLE_ID,

  // لو سيبتها فاضية، المراجعة هتكون للأدمن فقط
  reviewRoleId: process.env.REVIEW_ROLE_ID || null,

  embedColor: Number.parseInt(
    (process.env.EMBED_COLOR || "5865F2").replace("#", ""),
    16
  )
};

for (const key of [
  "token",
  "clientId",
  "commandRoleId",
  "mainGuildId",
  "logGuildId",
  "logChannelId",
  "acceptedRoleId"
]) {
  if (!CONFIG[key]) {
    throw new Error(`Missing .env value: ${key}`);
  }
}

if (!Number.isFinite(CONFIG.embedColor)) {
  throw new Error("Invalid EMBED_COLOR");
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

// ======================================================
// QUESTIONS
// ======================================================

const QUESTIONS = [
  {
    title: "الاسم",
    question: "اكتب اسمك."
  },
  {
    title: "السن",
    question: "اكتب سنك."
  },
  {
    title: "الخبرة في Kick",
    question: "احكيلنا عن خبرتك في Kick."
  },
  {
    title: "الـ Timeout",
    question:
      "ازاي تعمل Timeout للشخص وامتى تعمل له Timeout؟"
  },
  {
    title: "الـ Ban",
    question:
      "ازاي تعمل Ban للشخص وامتى تعمل له Ban؟"
  },
  {
    title: "التصويت",
    question:
      "تعمل ايه عشان تعمل تصويت وامتى تعمل تصويت؟"
  },
  {
    title: "تغيير وضع اللعبة",
    question:
      "تعمل ايه عشان تغير وضع اللعبة وامتى تغير وضع اللعبة؟"
  },
  {
    title: "تمكين وضع المشتركين فقط",
    question:
      "تعمل ايه لتمكين وضع المشتركين فقط في الدردشة؟"
  },
  {
    title: "إلغاء وضع المشتركين فقط",
    question:
      "تعمل ايه لإلغاء وضع المشتركين فقط في الدردشة؟"
  },
  {
    title: "Slow Mode",
    question:
      "ازاي تعمل سلو مود للشات؟"
  },
  {
    title: "عنوان البث",
    question:
      "ازاي تعين عنوان البث؟"
  }
];

// ======================================================
// STORAGE
// ======================================================

const applications = new Map();
const activeApplicants = new Set();

// ======================================================
// HELPERS
// ======================================================

function createEmbed(
  title,
  description = "",
  color = CONFIG.embedColor
) {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setFooter({
      text: "Elsisy Application"
    })
    .setTimestamp();
}

function safeText(value, max = 1000) {
  const text = String(value || "").trim();

  if (!text) {
    return "—";
  }

  if (text.length > max) {
    return text.slice(0, max - 3) + "...";
  }

  return text;
}

// ======================================================
// QUESTION EMBED
// ======================================================

function createQuestionEmbed(index) {
  const question = QUESTIONS[index];

  return createEmbed(
    `تقديم Mod Kick | ${index + 1}/${QUESTIONS.length}`,
    `**${question.title}**\n\n${question.question}\n\n` +
      `اضغط على زر **الإجابة** واكتب إجابتك.`
  );
}

// ======================================================
// ANSWER BUTTON
// ======================================================

function createAnswerRow(userId, index) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`answer:${userId}:${index}`)
      .setLabel("الإجابة")
      .setEmoji("📝")
      .setStyle(ButtonStyle.Primary)
  );
}

// ======================================================
// REVIEW BUTTONS
// ======================================================

function createReviewRow(appId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`accept:${appId}`)
      .setLabel("قبول")
      .setEmoji("✅")
      .setStyle(ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(`reject:${appId}`)
      .setLabel("رفض")
      .setEmoji("❌")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId(`ai:${appId}`)
      .setLabel("فحص AI")
      .setEmoji("🤖")
      .setStyle(ButtonStyle.Secondary)
  );
}

// ======================================================
// APPLICATION SUMMARY
// ======================================================

function createSummaryEmbed(
  app,
  status = "قيد المراجعة"
) {
  let color = CONFIG.embedColor;

  if (status === "تم القبول") {
    color = 0x2ecc71;
  }

  if (status === "تم الرفض") {
    color = 0xe74c3c;
  }

  const embed = createEmbed(
    "📋 تقديم Mod Kick",
    `**المتقدم:** <@${app.userId}>\n` +
      `**الحالة:** ${status}\n` +
      `**رقم التقديم:** \`${app.id}\``,
    color
  );

  embed.addFields(
    {
      name: "الاسم",
      value: safeText(app.answers[0], 250),
      inline: true
    },
    {
      name: "السن",
      value: safeText(app.answers[1], 100),
      inline: true
    },
    {
      name: "الخبرة في Kick",
      value: safeText(app.answers[2], 900)
    }
  );

  if (app.reviewerId) {
    embed.addFields({
      name:
        status === "تم القبول"
          ? "تم القبول بواسطة"
          : "تم الرفض بواسطة",
      value: `<@${app.reviewerId}>`,
      inline: true
    });
  }

  if (app.rejectReason) {
    embed.addFields({
      name: "سبب الرفض",
      value: safeText(app.rejectReason, 1000)
    });
  }

  return embed;
}

// ======================================================
// SEND ALL ANSWERS
// ======================================================

async function sendAnswers(channel, app) {
  for (
    let start = 0;
    start < QUESTIONS.length;
    start += 4
  ) {
    const fields = [];

    for (
      let i = start;
      i < Math.min(start + 4, QUESTIONS.length);
      i++
    ) {
      fields.push({
        name: `${i + 1}. ${QUESTIONS[i].title}`,
        value: safeText(app.answers[i], 1000)
      });
    }

    await channel.send({
      embeds: [
        createEmbed("📝 إجابات التقديم").addFields(fields)
      ]
    });
  }
}

// ======================================================
// REVIEW PERMISSION
// ======================================================

function canReview(interaction) {
  if (!interaction.inGuild()) {
    return false;
  }

  if (interaction.guildId !== CONFIG.mainGuildId) {
    return false;
  }

  if (
    interaction.memberPermissions?.has(
      PermissionsBitField.Flags.Administrator
    )
  ) {
    return true;
  }

  if (
    CONFIG.reviewRoleId &&
    interaction.member?.roles?.cache?.has(
      CONFIG.reviewRoleId
    )
  ) {
    return true;
  }

  return false;
}

// ======================================================
// AI STYLE CHECK
// ======================================================

// مجرد مؤشر أسلوبي تقريبي.
// ليس كاشف AI حقيقيًا ولا إثباتًا لاستخدام AI.

function estimateAIStyle(answers) {
  const texts = answers
    .filter(Boolean)
    .map(text => text.trim())
    .filter(Boolean);

  if (texts.length < QUESTIONS.length) {
    return {
      score: null,
      note: "الإجابات غير مكتملة."
    };
  }

  const fullText = texts.join(" ");

  let score = 0;
  const clues = [];

  const formalPhrases = [
    "بناءً على ما سبق",
    "من الجدير بالذكر",
    "علاوة على ذلك",
    "في الختام",
    "بالإضافة إلى ذلك",
    "يجب التنويه"
  ];

  const foundFormalPhrases =
    formalPhrases.filter(phrase =>
      fullText.includes(phrase)
    ).length;

  if (foundFormalPhrases >= 2) {
    score += 20;
    clues.push(
      "وجود عدة عبارات رسمية متكررة."
    );
  }

  const lengths = texts.map(text =>
    text
      .split(/\s+/)
      .filter(Boolean)
      .length
  );

  const average =
    lengths.reduce((a, b) => a + b, 0) /
    lengths.length;

  const variance =
    lengths.reduce(
      (sum, value) =>
        sum + Math.pow(value - average, 2),
      0
    ) / lengths.length;

  if (
    average > 0 &&
    variance < average * 0.35
  ) {
    score += 15;

    clues.push(
      "أطوال الإجابات متقاربة بصورة ملحوظة."
    );
  }

  if (average > 45) {
    score += 10;

    clues.push(
      "متوسط طول الإجابات مرتفع نسبيًا."
    );
  }

  const officialWords = [
    "الإجراءات اللازمة",
    "وفقًا للسياسة",
    "ضمان الالتزام",
    "إدارة المجتمع",
    "بما يتناسب مع"
  ];

  const officialCount =
    officialWords.filter(word =>
      fullText.includes(word)
    ).length;

  if (officialCount >= 2) {
    score += 15;

    clues.push(
      "استخدام عدة تعبيرات رسمية."
    );
  }

  return {
    score: Math.min(score, 100),
    note:
      clues.length > 0
        ? clues.join("\n")
        : "لم تظهر مؤشرات أسلوبية واضحة."
  };
}

// ======================================================
// SEND APPLICATION TO STAFF
// ======================================================

async function deliverApplication(app) {
  const mainGuild =
    await client.guilds.fetch(CONFIG.mainGuildId);

  const logGuild =
    await client.guilds.fetch(CONFIG.logGuildId);

  const mainChannel =
    await mainGuild.channels.fetch(
      app.applicationChannelId
    );

  const logChannel =
    await logGuild.channels.fetch(
      CONFIG.logChannelId
    );

  if (
    !mainChannel ||
    !mainChannel.isTextBased() ||
    !mainChannel.send
  ) {
    throw new Error(
      "Main application channel not found."
    );
  }

  if (
    !logChannel ||
    !logChannel.isTextBased() ||
    !logChannel.send
  ) {
    throw new Error(
      "Log channel not found."
    );
  }

  // رسالة التقديم في السيرفر الأساسي

  const starter =
    await mainChannel.send({
      content:
        `📥 **تقديم جديد**\n` +
        `المتقدم: <@${app.userId}>`,
      embeds: [
        createSummaryEmbed(app)
      ]
    });

  // إنشاء Thread

  const thread =
    await starter.startThread({
      name:
        `Mod Kick - ${app.username}`.slice(
          0,
          100
        ),
      autoArchiveDuration: 1440,
      reason:
        "Elsisy Application - Mod Kick"
    });

  app.threadId = thread.id;
  app.threadStarterId = starter.id;

  // إرسال الإجابات داخل الثريد

  await sendAnswers(thread, app);

  // أزرار المراجعة

  const reviewMessage =
    await thread.send({
      content:
        "🛡️ **إجراءات مراجعة التقديم:**",
      components: [
        createReviewRow(app.id)
      ]
    });

  app.reviewMessageId =
    reviewMessage.id;

  // ==================================================
  // LOG SERVER
  // ==================================================

  const logMessage =
    await logChannel.send({
      content:
        `📥 **تقديم جديد**\n` +
        `المتقدم: <@${app.userId}>`,
      embeds: [
        createSummaryEmbed(app)
      ]
    });

  app.logMessageId =
    logMessage.id;

  app.logChannelId =
    logChannel.id;

  // إرسال الإجابات في اللوج

  await sendAnswers(
    logChannel,
    app
  );
}

// ======================================================
// UPDATE AFTER ACCEPT / REJECT
// ======================================================

async function updateReview(
  app,
  status,
  reviewerId
) {
  const mainGuild =
    await client.guilds.fetch(
      CONFIG.mainGuildId
    );

  const thread =
    await mainGuild.channels.fetch(
      app.threadId
    ).catch(() => null);

  if (thread?.isThread()) {
    // تحديث رسالة بداية الثريد

    const starter =
      await thread.fetchStarterMessage()
        .catch(() => null);

    if (starter) {
      await starter.edit({
        content:
          `${status === "تم القبول" ? "✅" : "❌"} ` +
          `${status}\n` +
          `المتقدم: <@${app.userId}>\n` +
          `بواسطة: <@${reviewerId}>`,

        embeds: [
          createSummaryEmbed(
            app,
            status
          )
        ]
      });
    }

    // إزالة الأزرار

    const reviewMessage =
      await thread.messages.fetch(
        app.reviewMessageId
      ).catch(() => null);

    if (reviewMessage) {
      await reviewMessage.edit({
        content:
          `${status} بواسطة <@${reviewerId}>`,
        components: []
      });
    }
  }

  // ==================================================
  // UPDATE LOG
  // ==================================================

  const logGuild =
    await client.guilds.fetch(
      CONFIG.logGuildId
    );

  const logChannel =
    await logGuild.channels.fetch(
      app.logChannelId
    );

  const logMessage =
    await logChannel.messages.fetch(
      app.logMessageId
    );

  await logMessage.edit({
    content:
      `${status === "تم القبول" ? "✅" : "❌"} ` +
      `${status}\n` +
      `المتقدم: <@${app.userId}>\n` +
      `بواسطة: <@${reviewerId}>`,

    embeds: [
      createSummaryEmbed(
        app,
        status
      )
    ]
  });
}

// ======================================================
// READY
// ======================================================

client.once("ready", () => {
  console.log(
    `✅ ${client.user.tag} is online.`
  );
});

// ======================================================
// INTERACTIONS
// ======================================================

client.on(
  "interactionCreate",
  async interaction => {
    try {
      // ==================================================
      // /application
      // ==================================================

      if (
        interaction.isChatInputCommand() &&
        interaction.commandName ===
          "application"
      ) {
        if (!interaction.inGuild()) {
          return interaction.reply({
            content:
              "❌ الأمر ده متاح داخل السيرفر فقط.",
            ephemeral: true
          });
        }

        const member =
          interaction.member;

        const hasRole =
          member.roles.cache.has(
            CONFIG.commandRoleId
          );

        const isAdmin =
          member.permissions.has(
            PermissionsBitField.Flags
              .Administrator
          );

        if (!hasRole && !isAdmin) {
          return interaction.reply({
            content:
              "❌ مش معاك صلاحية استخدام الأمر.",
            ephemeral: true
          });
        }

        const panel =
          createEmbed(
            "🎮 Elsisy Application",

            "**التقديم على Mod Kick**\n\n" +

              "لو حابب تنضم لفريق الإدارة، " +
              "اضغط على زر **تقديم** وابدأ جاوب " +
              "على الأسئلة في الخاص.\n\n" +

              "📌 **تعليمات التقديم:**\n" +
              "• جاوب على جميع الأسئلة بوضوح.\n" +
              "• اقرأ السؤال كويس قبل الإجابة.\n" +
              "• ممنوع إرسال إجابات عشوائية.\n" +
              "• بعد انتهاء التقديم، الإدارة هتراجع طلبك.\n" +
              "• النتيجة هتوصلك على الخاص."
          );

        const row =
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(
                  "start_application"
                )
                .setLabel("تقديم")
                .setEmoji("📝")
                .setStyle(
                  ButtonStyle.Success
                )
            );

        return interaction.reply({
          embeds: [panel],
          components: [row]
        });
      }

      // ==================================================
      // START APPLICATION
      // ==================================================

      if (
        interaction.isButton() &&
        interaction.customId ===
          "start_application"
      ) {
        const userId =
          interaction.user.id;

        if (
          activeApplicants.has(userId)
        ) {
          return interaction.reply({
            content:
              "❌ عندك تقديم شغال بالفعل، كمل التقديم الحالي الأول.",
            ephemeral: true
          });
        }

        // التأكد من إمكانية إرسال DM

        try {
          await interaction.user.send({
            embeds: [
              createQuestionEmbed(0)
            ],
            components: [
              createAnswerRow(
                userId,
                0
              )
            ]
          });
        } catch {
          return interaction.reply({
            content:
              "❌ مش قادر أبعتلك رسالة في الخاص. افتح الـ DMs وجرب تاني.",
            ephemeral: true
          });
        }

        const app = {
          id:
            `${Date.now()}-${userId}`,

          userId,

          username:
            interaction.user.username,

          applicationChannelId:
            interaction.channelId,

          answers: [],

          currentQuestion: 0,

          status: "pending",

          reviewerId: null,

          rejectReason: null,

          threadId: null,

          threadStarterId: null,

          reviewMessageId: null,

          logChannelId:
            CONFIG.logChannelId,

          logMessageId: null
        };

        applications.set(
          app.id,
          app
        );

        activeApplicants.add(
          userId
        );

        return interaction.reply({
          content:
            "✅ تم بدء التقديم!\nراجع الخاص للإجابة على الأسئلة.",
          ephemeral: true
        });
      }

      // ==================================================
      // ANSWER BUTTON
      // ==================================================

      if (
        interaction.isButton() &&
        interaction.customId.startsWith(
          "answer:"
        )
      ) {
        const parts =
          interaction.customId.split(
            ":"
          );

        const userId = parts[1];
        const index =
          Number(parts[2]);

        if (
          interaction.user.id !==
          userId
        ) {
          return interaction.reply({
            content:
              "❌ الزر ده مش خاص بتقديمك.",
            ephemeral: true
          });
        }

        const app =
          [...applications.values()]
            .find(
              application =>
                application.userId ===
                  userId &&
                application.status ===
                  "pending"
            );

        if (
          !app ||
          app.currentQuestion !==
            index
        ) {
          return interaction.reply({
            content:
              "❌ السؤال ده مش متاح حاليًا.",
            ephemeral: true
          });
        }

        const question =
          QUESTIONS[index];

        const modal =
          new ModalBuilder()
            .setCustomId(
              `answer_modal:${userId}:${index}`
            )
            .setTitle(
              `السؤال ${index + 1}/${QUESTIONS.length}`
            );

        const input =
          new TextInputBuilder()
            .setCustomId(
              "answer_text"
            )
            .setLabel(
              question.title.slice(
                0,
                45
              )
            )
            .setStyle(
              TextInputStyle.Paragraph
            )
            .setPlaceholder(
              "اكتب إجابتك هنا..."
            )
            .setRequired(true)
            .setMaxLength(1000);

        modal.addComponents(
          new ActionRowBuilder()
            .addComponents(input)
        );

        return interaction.showModal(
          modal
        );
      }

      // ==================================================
      // ANSWER MODAL
      // ==================================================

      if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith(
          "answer_modal:"
        )
      ) {
        const parts =
          interaction.customId.split(
            ":"
          );

        const userId = parts[1];

        const index =
          Number(parts[2]);

        if (
          interaction.user.id !==
          userId
        ) {
          return interaction.reply({
            content:
              "❌ النموذج ده مش خاص بتقديمك.",
            ephemeral: true
          });
        }

        const app =
          [...applications.values()]
            .find(
              application =>
                application.userId ===
                  userId &&
                application.status ===
                  "pending"
            );

        if (
          !app ||
          app.currentQuestion !==
            index
        ) {
          return interaction.reply({
            content:
              "❌ الإجابة دي مش متاحة حاليًا.",
            ephemeral: true
          });
        }

        const answer =
          interaction.fields
            .getTextInputValue(
              "answer_text"
            )
            .trim();

        if (!answer) {
          return interaction.reply({
            content:
              "❌ لازم تكتب إجابة.",
            ephemeral: true
          });
        }

        app.answers[index] =
          answer;

        app.currentQuestion++;

        // ==================================================
        // NEXT QUESTION
        // ==================================================

        if (
          app.currentQuestion <
          QUESTIONS.length
        ) {
          await interaction.reply({
            content:
              `✅ تم تسجيل إجابتك ${index + 1}/${QUESTIONS.length}.`,
            ephemeral: true
          });

          try {
            await interaction.user.send({
              embeds: [
                createQuestionEmbed(
                  app.currentQuestion
                )
              ],
              components: [
                createAnswerRow(
                  userId,
                  app.currentQuestion
                )
              ]
            });
          } catch (error) {
            console.error(
              "DM error:",
              error
            );
          }

          return;
        }

        // ==================================================
        // FINISHED
        // ==================================================

        activeApplicants.delete(
          userId
        );

        await interaction.reply({
          content:
            "✅ **انتهى التقديم بنجاح!**\n\n" +
            "تم استلام جميع إجاباتك.\n" +
            "هيوصلك إشعار بالنتيجة على الخاص بعد مراجعة الإدارة.",
          ephemeral: true
        });

        try {
          await deliverApplication(
            app
          );
        } catch (error) {
          console.error(
            "Application delivery error:",
            error
          );

          try {
            await interaction.user.send(
              "⚠️ تم تسجيل إجاباتك، لكن حصلت مشكلة أثناء إرسال التقديم للإدارة. تواصل مع الإدارة."
            );
          } catch {}
        }

        return;
      }

      // ==================================================
      // REVIEW BUTTONS
      // ==================================================

      if (
        interaction.isButton() &&
        (
          interaction.customId.startsWith(
            "accept:"
          ) ||
          interaction.customId.startsWith(
            "reject:"
          ) ||
          interaction.customId.startsWith(
            "ai:"
          )
        )
      ) {
        const parts =
          interaction.customId.split(
            ":"
          );

        const action = parts[0];
        const appId = parts[1];

        const app =
          applications.get(appId);

        if (!app) {
          return interaction.reply({
            content:
              "❌ التقديم مش موجود في ذاكرة البوت. غالبًا البوت اتعمله Restart.",
            ephemeral: true
          });
        }

        if (
          !canReview(interaction)
        ) {
          return interaction.reply({
            content:
              "❌ مش معاك صلاحية مراجعة التقديم.",
            ephemeral: true
          });
        }

        // ==================================================
        // AI CHECK
        // ==================================================

        if (action === "ai") {
          const result =
            estimateAIStyle(
              app.answers
            );

          if (
            result.score === null
          ) {
            return interaction.reply({
              embeds: [
                createEmbed(
                  "🤖 فحص AI",
                  result.note
                )
              ],
              ephemeral: true
            });
          }

          return interaction.reply({
            embeds: [
              createEmbed(
                "🤖 فحص أسلوب الإجابات",

                `**المؤشر الأسلوبي التقريبي:** \`${result.score}%\`\n\n` +

                `${result.note}\n\n` +

                "⚠️ **مهم:** المؤشر ده مش كاشف AI حقيقي، ومش إثبات إن الشخص استخدم AI. لا تعتمد عليه وحده في قرار القبول أو الرفض."
              )
            ],
            ephemeral: true
          });
        }

        // ==================================================
        // ALREADY REVIEWED
        // ==================================================

        if (
          app.status !==
          "pending"
        ) {
          return interaction.reply({
            content:
              "❌ التقديم ده تمت مراجعته بالفعل.",
            ephemeral: true
          });
        }

        // ==================================================
        // REJECT
        // ==================================================

        if (
          action === "reject"
        ) {
          const modal =
            new ModalBuilder()
              .setCustomId(
                `reject_modal:${app.id}`
              )
              .setTitle(
                "رفض التقديم"
              );

          const reasonInput =
            new TextInputBuilder()
              .setCustomId(
                "reject_reason"
              )
              .setLabel(
                "سبب الرفض"
              )
              .setStyle(
                TextInputStyle.Paragraph
              )
              .setPlaceholder(
                "اكتب سبب رفض التقديم..."
              )
              .setRequired(true)
              .setMinLength(3)
              .setMaxLength(1000);

          modal.addComponents(
            new ActionRowBuilder()
              .addComponents(
                reasonInput
              )
          );

          return interaction.showModal(
            modal
          );
        }

        // ==================================================
        // ACCEPT
        // ==================================================

        if (
          action === "accept"
        ) {
          await interaction.deferReply({
            ephemeral: true
          });

          const guild =
            await client.guilds.fetch(
              CONFIG.mainGuildId
            );

          const member =
            await guild.members.fetch(
              app.userId
            ).catch(() => null);

          if (!member) {
            return interaction.editReply(
              "❌ المتقدم مش موجود في السيرفر الأساسي."
            );
          }

          try {
            await member.roles.add(
              CONFIG.acceptedRoleId,
              `Elsisy Application accepted by ${interaction.user.tag}`
            );
          } catch (error) {
            console.error(
              "Role assignment error:",
              error
            );

            return interaction.editReply(
              "❌ فشلت إضافة الرول. تأكد إن البوت أعلى من الرول ومعاه Manage Roles."
            );
          }

          app.status =
            "accepted";

          app.reviewerId =
            interaction.user.id;

          await updateReview(
            app,
            "تم القبول",
            interaction.user.id
          );

          // ==================================================
          // DM ACCEPT
          // ==================================================

          try {
            await member.send({
              embeds: [
                createEmbed(
                  "🎉 تهانينا! تم قبولك مبدئيًا",

                  `أهلًا <@${app.userId}>!\n\n` +

                  "تم قبول تقديمك على **Mod Kick** مبدئيًا في Elsisy.\n\n" +

                  "🎉 مبروك!\n" +
                  "تابع تعليمات الإدارة والخطوات القادمة.",

                  0x2ecc71
                )
              ]
            });
          } catch {
            console.log(
              `Could not DM ${app.userId}`
            );
          }

          return interaction.editReply(
            "✅ تم قبول التقديم وإضافة الرول وإبلاغ المتقدم."
          );
        }
      }

      // ==================================================
      // REJECT MODAL
      // ==================================================

      if (
        interaction.isModalSubmit() &&
        interaction.customId.startsWith(
          "reject_modal:"
        )
      ) {
        const parts =
          interaction.customId.split(
            ":"
          );

        const appId =
          parts[1];

        const app =
          applications.get(
            appId
          );

        if (!app) {
          return interaction.reply({
            content:
              "❌ التقديم مش موجود في ذاكرة البوت.",
            ephemeral: true
          });
        }

        if (
          !canReview(interaction)
        ) {
          return interaction.reply({
            content:
              "❌ مش معاك صلاحية مراجعة التقديم.",
            ephemeral: true
          });
        }

        if (
          app.status !==
          "pending"
        ) {
          return interaction.reply({
            content:
              "❌ التقديم تمت مراجعته بالفعل.",
            ephemeral: true
          });
        }

        const reason =
          interaction.fields
            .getTextInputValue(
              "reject_reason"
            )
            .trim();

        if (!reason) {
          return interaction.reply({
            content:
              "❌ لازم تكتب سبب الرفض.",
            ephemeral: true
          });
        }

        await interaction.deferReply({
          ephemeral: true
        });

        app.status =
          "rejected";

        app.reviewerId =
          interaction.user.id;

        app.rejectReason =
          reason;

        await updateReview(
          app,
          "تم الرفض",
          interaction.user.id
        );

        // ==================================================
        // DM REJECT
        // ==================================================

        try {
          const user =
            await client.users.fetch(
              app.userId
            );

          await user.send({
            embeds: [
              createEmbed(
                "❌ حظ أوفر في المرة القادمة",

                `للأسف تم رفض تقديمك على **Mod Kick** في Elsisy.\n\n` +

                `**سبب الرفض:**\n${reason}\n\n` +

                "شكرًا لاهتمامك بالتقديم، ونتمنى لك التوفيق.",

                0xe74c3c
              )
            ]
          });
        } catch {
          console.log(
            `Could not DM ${app.userId}`
          );
        }

        return interaction.editReply(
          "✅ تم رفض التقديم وتحديث اللوج وإرسال سبب الرفض للمتقدم."
        );
      }
    } catch (error) {
      console.error(
        "Interaction error:",
        error
      );

      if (
        !interaction.replied &&
        !interaction.deferred
      ) {
        await interaction.reply({
          content:
            "❌ حصل خطأ أثناء تنفيذ الطلب.",
          ephemeral: true
        }).catch(() => {});
      }
    }
  }
);

// ======================================================
// REGISTER + LOGIN
// ======================================================

(async () => {
  try {
    const rest =
      new REST({
        version: "10"
      }).setToken(
        CONFIG.token
      );

    await rest.put(
      Routes.applicationCommands(
        CONFIG.clientId
      ),
      {
        body: [
          command.toJSON()
        ]
      }
    );

    console.log(
      "✅ /application registered."
    );

    await client.login(
      CONFIG.token
    );
  } catch (error) {
    console.error(
      "❌ Startup error:",
      error
    );

    process.exit(1);
  }
})();