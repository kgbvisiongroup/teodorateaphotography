// Veza sa serverom studija: prijava, čitanje i upis podataka.
// Aplikacija koristi iste adrese kao panel u pregledaču (/api/admin/...),
// pa radi nad istom bazom i istim podacima.
import Foundation

// MARK: - Greške

enum APIError: LocalizedError {
    case noServer
    case unauthorized
    case server(String)
    case network(String)

    var errorDescription: String? {
        switch self {
        case .noServer: return "Nije upisana adresa servera."
        case .unauthorized: return "Niste prijavljeni."
        case .server(let m): return m
        case .network(let m): return m
        }
    }
}

// MARK: - Klijent

@MainActor
final class API: ObservableObject {
    static let shared = API()

    @Published var baseURL: String {
        didSet { UserDefaults.standard.set(baseURL, forKey: "baseURL") }
    }

    private let session: URLSession

    private init() {
        baseURL = UserDefaults.standard.string(forKey: "baseURL") ?? ""
        let cfg = URLSessionConfiguration.default
        cfg.httpCookieStorage = HTTPCookieStorage.shared
        cfg.httpCookieAcceptPolicy = .always
        cfg.httpShouldSetCookies = true
        cfg.timeoutIntervalForRequest = 30
        cfg.waitsForConnectivity = true
        session = URLSession(configuration: cfg)
    }

    /// Adresa se upisuje kao "panel.teodorateaphotography.com" ili sa https:// – oba rade.
    func normalized(_ raw: String) -> String {
        var s = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.isEmpty { return s }
        if !s.lowercased().hasPrefix("http://") && !s.lowercased().hasPrefix("https://") { s = "https://" + s }
        while s.hasSuffix("/") { s.removeLast() }
        return s
    }

    private func url(_ path: String) throws -> URL {
        let base = normalized(baseURL)
        guard !base.isEmpty, let u = URL(string: base + path) else { throw APIError.noServer }
        return u
    }

    private func request(_ method: String, _ path: String, body: [String: Any]? = nil) throws -> URLRequest {
        var r = URLRequest(url: try url(path))
        r.httpMethod = method
        if let body {
            r.setValue("application/json", forHTTPHeaderField: "Content-Type")
            r.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        return r
    }

    @discardableResult
    private func run(_ r: URLRequest) async throws -> Data {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: r)
        } catch {
            throw APIError.network(error.localizedDescription)
        }
        guard let http = response as? HTTPURLResponse else { throw APIError.network("Neočekivan odgovor servera.") }
        if http.statusCode == 401 { throw APIError.unauthorized }
        if !(200..<300).contains(http.statusCode) {
            let msg = (try? JSONDecoder().decode([String: String].self, from: data))?["error"]
            throw APIError.server(msg ?? "Greška \(http.statusCode)")
        }
        return data
    }

    private let decoder: JSONDecoder = {
        let d = JSONDecoder()
        return d
    }()

    func get<T: Decodable>(_ path: String, as type: T.Type = T.self) async throws -> T {
        let data = try await run(try request("GET", path))
        do { return try decoder.decode(T.self, from: data) }
        catch { throw APIError.server("Podaci sa servera nisu u očekivanom obliku.") }
    }

    @discardableResult
    func post(_ path: String, _ body: [String: Any]? = nil) async throws -> Data {
        try await run(try request("POST", path, body: body))
    }

    @discardableResult
    func put(_ path: String, _ body: [String: Any]? = nil) async throws -> Data {
        try await run(try request("PUT", path, body: body))
    }

    func post<T: Decodable>(_ path: String, _ body: [String: Any]? = nil, as type: T.Type) async throws -> T {
        let data = try await run(try request("POST", path, body: body))
        do { return try decoder.decode(T.self, from: data) }
        catch { throw APIError.server("Podaci sa servera nisu u očekivanom obliku.") }
    }

    // MARK: Prijava

    func login(server: String, username: String, password: String) async throws -> Me {
        baseURL = normalized(server)
        _ = try await post("/api/admin/login", ["username": username, "password": password, "remember": true])
        return try await get("/api/admin/me", as: Me.self)
    }

    func me() async throws -> Me {
        try await get("/api/admin/me", as: Me.self)
    }

    func logout() async {
        _ = try? await post("/api/admin/logout")
        if let host = URL(string: normalized(baseURL))?.host {
            for c in HTTPCookieStorage.shared.cookies ?? [] where c.domain.contains(host) {
                HTTPCookieStorage.shared.deleteCookie(c)
            }
        }
    }

    /// Puna adresa slike sa servera (npr. profilna slika korisnika).
    func absolute(_ path: String?) -> URL? {
        guard let path, !path.isEmpty else { return nil }
        if path.hasPrefix("http") { return URL(string: path) }
        return URL(string: normalized(baseURL) + path)
    }
}

// MARK: - Modeli (ista polja koja šalje server)

struct Me: Codable {
    var authed: Bool
    var user: User?
    var defaultPassword: Bool?
}

struct User: Codable, Identifiable {
    var id: String
    var username: String
    var name: String
    var email: String?
    var role: String
    var photo: String?
}

struct Stats: Codable {
    var active: Int?
    var storage: Double?
    var waiting: Int?
    var upcoming: [Booking]?
    var editing: [Booking]?
    var overdue: Int?
    var newRequests: Int?
    var lowStock: Int?
    var newAlbums: Int?
    var acceptedOffers: Int?
    var smtpReady: Bool?
    var isAdmin: Bool?
}

struct Booking: Codable, Identifiable {
    var id: String
    var category: String
    var catName: String?
    var color: String?
    var date: String
    var time: String?
    var location: String?
    var firstName: String?
    var lastName: String?
    var parentName: String?
    var clientName: String?
    var email: String?
    var phone: String?
    var note: String?
    var packageName: String?
    var packagePrice: Double?
    var total: Double?
    var deposit: Double?
    var remaining: Double?
    var status: String?
    var deadlineDate: String?
    var daysLeft: Int?
    var editedAt: Double?
    var cancelled: Bool?
    var age: String?
    var start: Double?
    var church: String?
}

struct Offer: Codable, Identifiable {
    var id: String
    var code: String
    var token: String
    var clientName: String
    var email: String
    var phone: String?
    var category: String?
    var categoryName: String?
    var status: String
    var validUntil: String?
    var date: String?
    var time: String?
    var location: String?
    var intro: String?
    var clientNote: String?
    var sentAt: Double?
    var answeredAt: Double?
    var price: OfferPrice
}

struct OfferPrice: Codable {
    var packageName: String?
    var packagePrice: Double?
    var extrasTotal: Double?
    var discountPct: Double?
    var total: Double
    var deposit: Double
    var remaining: Double
}

struct SiteRequest: Codable, Identifiable {
    var id: String
    var kind: String?
    var name: String?
    var email: String?
    var phone: String?
    var category: String?
    var categoryName: String?
    var date: String?
    var time: String?
    var location: String?
    var packageName: String?
    var message: String?
    var status: String?
    var at: Double?
    var note: String?
}

struct NoteItem: Codable, Identifiable {
    var id: String
    var at: Double
    var type: String
    var title: String
    var text: String?
    var link: String?
    var read: Bool?
}

struct NotesResponse: Codable {
    var items: [NoteItem]
    var unread: Int
}

struct Meta: Codable {
    var categories: [Category]?
    var currencySymbol: String?
    var locations: [String]?
    var today: String?
}

struct Category: Codable, Identifiable {
    var key: String
    var name: String
    var color: String?
    var id: String { key }
}

struct Package: Codable, Identifiable {
    var id: String
    var name: String
    var category: String
    var price: Double
    var active: Bool?
}

struct AlbumOrder: Codable, Identifiable {
    var id: String
    var token: String
    var format: String?
    var size: String?
    var spreads: Int?
    var photos: Int?
    var status: String
    var price: Double?
    var orderedAt: Double?
    var customer: AlbumCustomer?
}

struct AlbumCustomer: Codable {
    var name: String?
    var email: String?
    var phone: String?
    var note: String?
}

struct Voucher: Codable, Identifiable {
    var id: String
    var code: String
    var recipientName: String
    var fromName: String?
    var value: String?
    var validUntil: String
    var status: String
    var daysLeft: Int?
}

struct Product: Codable, Identifiable {
    var id: String
    var name: String
    var kind: String?
    var stock: Int
    var minStock: Int?
    var onOrder: Int?
    var low: Bool?
    var active: Bool?
}
