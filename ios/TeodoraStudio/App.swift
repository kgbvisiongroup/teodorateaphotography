// Teodora Photography Studio – aplikacija za vođenje studija sa telefona i tableta.
import SwiftUI

@main
struct TeodoraStudioApp: App {
    @StateObject private var api = API.shared
    @StateObject private var session = Session()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(api)
                .environmentObject(session)
                .tint(Brand.accent)
        }
    }
}

// MARK: - Stanje prijave

@MainActor
final class Session: ObservableObject {
    enum State { case checking, loggedOut, loggedIn }

    @Published var state: State = .checking
    @Published var user: User?
    @Published var error: String?

    func restore() async {
        guard !API.shared.baseURL.isEmpty else { state = .loggedOut; return }
        do {
            let me = try await API.shared.me()
            if me.authed, let u = me.user {
                user = u
                state = .loggedIn
            } else {
                state = .loggedOut
            }
        } catch {
            state = .loggedOut
        }
    }

    func login(server: String, username: String, password: String) async {
        error = nil
        do {
            let me = try await API.shared.login(server: server, username: username, password: password)
            guard me.authed, let u = me.user else { throw APIError.unauthorized }
            user = u
            state = .loggedIn
        } catch {
            self.error = error.localizedDescription
        }
    }

    func logout() async {
        await API.shared.logout()
        user = nil
        state = .loggedOut
    }
}

// MARK: - Boje i sitni delovi izgleda

enum Brand {
    static let accent = Color(red: 0.70, green: 0.34, blue: 0.39)
    static let deep = Color(red: 0.45, green: 0.20, blue: 0.25)
    static let ink = Color(red: 0.29, green: 0.20, blue: 0.21)
    static let wash = Color(red: 0.99, green: 0.97, blue: 0.96)
    static let blush = Color(red: 0.98, green: 0.93, blue: 0.93)
    static let ok = Color(red: 0.31, green: 0.57, blue: 0.40)
    static let warn = Color(red: 0.76, green: 0.55, blue: 0.24)
    static let err = Color(red: 0.75, green: 0.23, blue: 0.17)
}

struct StatusTag: View {
    let text: String
    var color: Color = Brand.accent

    var body: some View {
        Text(text)
            .font(.caption.weight(.medium))
            .padding(.horizontal, 9)
            .padding(.vertical, 3)
            .background(color.opacity(0.13), in: Capsule())
            .foregroundStyle(color)
    }
}

struct Card<Content: View>: View {
    private let content: Content

    init(@ViewBuilder content: () -> Content) { self.content = content() }

    var body: some View {
        content
            .padding(16)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color(.systemBackground), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(Brand.blush, lineWidth: 1))
    }
}

struct EmptyNote: View {
    let text: String
    var body: some View {
        Text(text)
            .font(.subheadline)
            .foregroundStyle(.secondary)
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.vertical, 28)
    }
}

// MARK: - Pomoćne funkcije za prikaz

enum Fmt {
    static let months = ["januar", "februar", "mart", "april", "maj", "jun", "jul", "avgust", "septembar", "oktobar", "novembar", "decembar"]

    /// "2026-10-20" -> "20. oktobar 2026."
    static func date(_ s: String?) -> String {
        guard let s, s.count == 10 else { return "" }
        let p = s.split(separator: "-").map(String.init)
        guard p.count == 3, let m = Int(p[1]), let d = Int(p[2]), m >= 1, m <= 12 else { return s }
        return "\(d). \(months[m - 1]) \(p[0])."
    }

    static func dateShort(_ s: String?) -> String {
        guard let s, s.count == 10 else { return "" }
        let p = s.split(separator: "-").map(String.init)
        guard p.count == 3, let m = Int(p[1]), let d = Int(p[2]), m >= 1, m <= 12 else { return s }
        return "\(d). \(months[m - 1])"
    }

    static func money(_ v: Double?, _ symbol: String = "€") -> String {
        guard let v else { return "" }
        return "\(Int(v.rounded())) \(symbol)"
    }

    static func stamp(_ ms: Double?) -> String {
        guard let ms else { return "" }
        let d = Date(timeIntervalSince1970: ms / 1000)
        let f = DateFormatter()
        f.locale = Locale(identifier: "sr_RS")
        f.dateFormat = "d. MMMM 'u' HH:mm"
        return f.string(from: d)
    }

    static func size(_ bytes: Double?) -> String {
        guard let bytes, bytes > 0 else { return "0 MB" }
        let gb = bytes / 1_073_741_824
        if gb >= 1 { return String(format: "%.1f GB", gb) }
        return String(format: "%.0f MB", bytes / 1_048_576)
    }

    static func today() -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Date())
    }

    static func addDays(_ days: Int) -> String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: Calendar.current.date(byAdding: .day, value: days, to: Date()) ?? Date())
    }
}

/// Boje statusa zakazivanja i ponuda, iste kao u panelu.
enum Status {
    static func booking(_ s: String?) -> (String, Color) {
        switch s {
        case "upcoming": return ("Predstoji", Brand.accent)
        case "processing": return ("U obradi", Brand.warn)
        case "overdue": return ("Kasni", Brand.err)
        case "done": return ("Završeno", Brand.ok)
        case "cancelled": return ("Otkazano", .gray)
        default: return (s ?? "", .gray)
        }
    }

    static func offer(_ s: String) -> (String, Color) {
        switch s {
        case "draft": return ("Nacrt", .gray)
        case "sent": return ("Poslato", Brand.warn)
        case "accepted": return ("Prihvaćeno", Brand.ok)
        case "declined": return ("Odbijeno", Brand.err)
        case "expired": return ("Isteklo", .gray)
        case "booked": return ("Zakazano", Brand.ok)
        default: return (s, .gray)
        }
    }
}
