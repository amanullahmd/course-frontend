package me.amanullah.course.flashcard;

import me.amanullah.course.common.exception.BadRequestException;
import me.amanullah.course.common.exception.NotFoundException;
import me.amanullah.course.common.exception.ValidationException;
import me.amanullah.course.course.ContentItem;
import me.amanullah.course.course.CourseAccess;
import me.amanullah.course.course.ItemType;
import me.amanullah.course.flashcard.FlashcardDtos.CsvCardDto;
import me.amanullah.course.flashcard.FlashcardDtos.CsvErrorDto;
import me.amanullah.course.flashcard.FlashcardDtos.DeckDto;
import me.amanullah.course.flashcard.FlashcardDtos.DeckUpsert;
import me.amanullah.course.flashcard.FlashcardDtos.FlashcardUpsert;
import me.amanullah.course.flashcard.FlashcardDtos.ImportResultDto;
import me.amanullah.course.media.MediaAsset;
import me.amanullah.course.media.MediaKind;
import me.amanullah.course.media.MediaService;
import me.amanullah.course.security.CurrentUser;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/** Deck editor of a FLASHCARDS item (instructor side). */
@Service
public class FlashcardService {

    static final long MAX_IMPORT_BYTES = 2L * 1024 * 1024;

    private final FlashcardRepository cards;
    private final CourseAccess access;
    private final MediaService mediaService;
    private final FlashcardMapper mapper;

    public FlashcardService(FlashcardRepository cards, CourseAccess access, MediaService mediaService,
                            FlashcardMapper mapper) {
        this.cards = cards;
        this.access = access;
        this.mediaService = mediaService;
        this.mapper = mapper;
    }

    public static ContentItem requireDeck(ContentItem item) {
        if (item.getType() != ItemType.FLASHCARDS) {
            throw new NotFoundException("FLASHCARDS_NOT_FOUND", "This item is not a flashcard deck");
        }
        return item;
    }

    @Transactional(readOnly = true)
    public DeckDto get(CurrentUser me, UUID itemId) {
        ContentItem item = requireDeck(access.item(itemId, me));
        return deck(item);
    }

    @Transactional
    public DeckDto replace(CurrentUser me, UUID itemId, DeckUpsert req) {
        ContentItem item = requireDeck(access.item(itemId, me));
        Map<UUID, Flashcard> existing = new HashMap<>();
        cards.findByItemIdOrderByPositionAsc(item.getId()).forEach(c -> existing.put(c.getId(), c));
        List<Flashcard> kept = new ArrayList<>();
        List<FlashcardUpsert> requested = req.cards();
        for (int i = 0; i < requested.size(); i++) {
            FlashcardUpsert r = requested.get(i);
            String path = "cards[" + i + "]";
            Flashcard c;
            if (r.id() != null) {
                c = existing.remove(r.id());
                if (c == null) {
                    throw ValidationException.field(path + ".id", "validation.unknownCard");
                }
            } else {
                c = new Flashcard(item);
            }
            apply(c, r, i, path, me);
            kept.add(c);
        }
        cards.deleteAll(existing.values());
        cards.flush();
        cards.saveAll(kept);
        item.touch();
        cards.flush();
        return deck(item);
    }

    /**
     * CSV import ({@code front;back;article;plural;example}). Without {@code commit} only a preview is returned;
     * with it, the valid rows are appended to the deck (rows with errors are skipped and reported).
     */
    @Transactional
    public ImportResultDto importCsv(CurrentUser me, UUID itemId, MultipartFile file, boolean commit) {
        ContentItem item = requireDeck(access.item(itemId, me));
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("FILE_EMPTY", "Please choose a non-empty file");
        }
        if (file.getSize() > MAX_IMPORT_BYTES) {
            throw new BadRequestException("FILE_TOO_LARGE", "The uploaded file is too large");
        }
        String text;
        try {
            text = new String(file.getBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new BadRequestException("FILE_EMPTY", "The file could not be read");
        }
        FlashcardCsv.Result parsed = FlashcardCsv.parse(text);
        long existing = cards.countByItemId(item.getId());
        if (existing + parsed.cards().size() > FlashcardCsv.MAX_CARDS) {
            throw new BadRequestException("TOO_MANY_CARDS", "A deck can have at most " + FlashcardCsv.MAX_CARDS
                    + " cards").key("error.TOO_MANY_CARDS", FlashcardCsv.MAX_CARDS);
        }
        List<CsvCardDto> preview = parsed.cards().stream()
                .map(c -> new CsvCardDto(c.front(), c.back(), c.article(), c.plural(), c.example())).toList();
        List<CsvErrorDto> errors = parsed.errors().stream()
                .map(e -> new CsvErrorDto(e.line(), e.field(), e.code())).toList();
        int total = (int) existing;
        if (commit) {
            int position = (int) existing;
            List<Flashcard> created = new ArrayList<>();
            for (FlashcardCsv.Card card : parsed.cards()) {
                Flashcard c = new Flashcard(item);
                c.setFront(card.front());
                c.setBack(card.back());
                c.setArticle(card.article());
                c.setPlural(card.plural());
                c.setExample(card.example());
                c.setPosition(position++);
                created.add(c);
            }
            cards.saveAll(created);
            item.touch();
            total += created.size();
        }
        return new ImportResultDto(parsed.rows(), preview, errors, commit, commit ? preview.size() : 0, total);
    }

    public record CsvExport(String fileName, byte[] bytes) {
    }

    @Transactional(readOnly = true)
    public CsvExport exportCsv(CurrentUser me, UUID itemId) {
        ContentItem item = requireDeck(access.item(itemId, me));
        byte[] bytes = FlashcardCsv.export(cards.findByItemIdOrderByPositionAsc(item.getId()).stream()
                .map(c -> new FlashcardCsv.Card(c.getFront(), c.getBack(), c.getArticle(), c.getPlural(),
                        c.getExample())).toList());
        String base = item.getTitle().replaceAll("[^\\p{L}\\p{N}]+", "-").replaceAll("^-|-$", "");
        return new CsvExport((base.isEmpty() ? "flashcards" : base) + ".csv", bytes);
    }

    private DeckDto deck(ContentItem item) {
        return new DeckDto(item.getId(), cards.findByItemIdOrderByPositionAsc(item.getId()).stream()
                .map(mapper::toDto).toList());
    }

    private void apply(Flashcard c, FlashcardUpsert r, int position, String path, CurrentUser me) {
        c.setFront(FlashcardCsv.clean(r.front()));
        c.setBack(FlashcardCsv.clean(r.back()));
        if (c.getFront().isEmpty()) {
            throw ValidationException.field(path + ".front", "validation.required");
        }
        if (c.getBack().isEmpty()) {
            throw ValidationException.field(path + ".back", "validation.required");
        }
        String article = r.article() == null ? "" : r.article().strip();
        String normalized = FlashcardCsv.normalizeArticle(article);
        if (normalized == null && !article.isEmpty()) {
            throw ValidationException.field(path + ".article", "validation.article");
        }
        c.setArticle(normalized);
        c.setPlural(blankToNull(r.plural()));
        c.setExample(blankToNull(r.example()));
        c.setAudio(media(r.audioMediaId(), c.getAudio(), MediaKind.AUDIO, path + ".audioMediaId", "validation.audio", me));
        c.setImage(media(r.imageMediaId(), c.getImage(), MediaKind.IMAGE, path + ".imageMediaId", "validation.image", me));
        c.setPosition(position);
    }

    private MediaAsset media(UUID id, MediaAsset current, MediaKind kind, String field, String key, CurrentUser me) {
        if (id == null) {
            return null;
        }
        if (current != null && current.getId().equals(id)) {
            return current;
        }
        MediaAsset m;
        try {
            m = mediaService.requireUsable(id, me.id(), me.isAdmin());
        } catch (NotFoundException e) {
            throw ValidationException.field(field, "validation.invalidValue");
        }
        if (m.getKind() != kind) {
            throw ValidationException.field(field, key);
        }
        return m;
    }

    private static String blankToNull(String s) {
        String v = FlashcardCsv.clean(s);
        return v.isEmpty() ? null : v;
    }
}
